import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { decrypt, encrypt } from '~/utils/encryption'
import { RoomConfigFileSchema, redactRoomConfig } from '~/types/room-config'
import type {
  CreateRoomRequest,
  RoomConfig,
  RoomConfigFile,
  RoomConfigPublic,
  UpdateRoomRequest,
} from '~/types/room-config'

export class RoomConfigStoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'RoomConfigStoreError'
  }
}

interface CreateRoomStoreParams extends CreateRoomRequest {
  destinationRoomId: number
}

interface RoomConfigStoreOptions {
  dataDir: string
  encryptionKeyHex: string
}

function isEnoentError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

export class RoomConfigStore {
  private readonly configPath: string
  private readonly encryptionKeyHex: string
  private roomsByOriginalId = new Map<number, RoomConfig>()
  private roomsById = new Map<string, RoomConfig>()
  private mutex = false
  private readonly mutexQueue: (() => void)[] = []

  constructor(options: RoomConfigStoreOptions) {
    this.configPath = join(options.dataDir, 'room-configs.json')
    this.encryptionKeyHex = options.encryptionKeyHex
  }

  async init(): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true })

    const data = await this.loadConfig()
    this.rebuildIndex(data.rooms)
  }

  list(): RoomConfigPublic[] {
    return Array.from(this.roomsById.values()).map(redactRoomConfig)
  }

  getById(id: string): RoomConfigPublic | null {
    const room = this.roomsById.get(id)
    return room !== undefined ? redactRoomConfig(room) : null
  }

  getByOriginalRoomId(originalRoomId: number): RoomConfig | null {
    return this.roomsByOriginalId.get(originalRoomId) ?? null
  }

  async create(params: CreateRoomStoreParams): Promise<RoomConfig> {
    return this.withMutex(async () => {
      if (this.roomsByOriginalId.has(params.originalRoomId)) {
        throw new RoomConfigStoreError(
          `originalRoomId ${params.originalRoomId.toString()} already exists`,
          'DUPLICATE_ORIGINAL_ROOM_ID',
        )
      }

      const now = new Date().toISOString()
      const room: RoomConfig = {
        id: crypto.randomUUID(),
        originalRoomId: params.originalRoomId,
        destinationRoomId: params.destinationRoomId,
        destinationRoomName: params.destinationRoomName,
        aiProvider: params.aiProvider,
        aiModel: params.aiModel,
        translationStyle: params.translationStyle,
        encryptedAiApiToken: await encrypt(params.aiApiToken, this.encryptionKeyHex),
        encryptedWebhookSecret: await encrypt(params.webhookSecret, this.encryptionKeyHex),
        enabled: false,
        createdAt: now,
        updatedAt: now,
      }

      const rooms = this.allRooms()
      rooms.push(room)

      await this.writeConfig({ version: 1, rooms })
      this.rebuildIndex(rooms)

      return room
    })
  }

  async update(id: string, patch: UpdateRoomRequest): Promise<RoomConfigPublic> {
    return this.withMutex(async () => {
      const existing = this.roomsById.get(id)
      if (existing === undefined) {
        throw new RoomConfigStoreError(`Room ${id} not found`, 'NOT_FOUND')
      }

      const encryptedAiApiToken =
        patch.aiApiToken !== undefined
          ? await encrypt(patch.aiApiToken, this.encryptionKeyHex)
          : existing.encryptedAiApiToken

      const encryptedWebhookSecret =
        patch.webhookSecret !== undefined
          ? await encrypt(patch.webhookSecret, this.encryptionKeyHex)
          : existing.encryptedWebhookSecret

      const updated: RoomConfig = {
        ...existing,
        ...(patch.destinationRoomName !== undefined
          ? { destinationRoomName: patch.destinationRoomName }
          : {}),
        ...(patch.aiProvider !== undefined ? { aiProvider: patch.aiProvider } : {}),
        ...(patch.aiModel !== undefined ? { aiModel: patch.aiModel } : {}),
        ...(patch.translationStyle !== undefined
          ? { translationStyle: patch.translationStyle }
          : {}),
        encryptedAiApiToken,
        encryptedWebhookSecret,
        updatedAt: new Date().toISOString(),
      }

      const rooms = this.allRooms().map((room) => (room.id === id ? updated : room))
      await this.writeConfig({ version: 1, rooms })
      this.rebuildIndex(rooms)

      return redactRoomConfig(updated)
    })
  }

  async setEnabled(id: string, enabled: boolean): Promise<RoomConfigPublic> {
    return this.withMutex(async () => {
      const existing = this.roomsById.get(id)
      if (existing === undefined) {
        throw new RoomConfigStoreError(`Room ${id} not found`, 'NOT_FOUND')
      }

      const updated: RoomConfig = {
        ...existing,
        enabled,
        updatedAt: new Date().toISOString(),
      }

      const rooms = this.allRooms().map((room) => (room.id === id ? updated : room))
      await this.writeConfig({ version: 1, rooms })
      this.rebuildIndex(rooms)

      return redactRoomConfig(updated)
    })
  }

  async delete(id: string): Promise<void> {
    return this.withMutex(async () => {
      const existing = this.roomsById.get(id)
      if (existing === undefined) {
        throw new RoomConfigStoreError(`Room ${id} not found`, 'NOT_FOUND')
      }

      const rooms = this.allRooms().filter((room) => room.id !== id)
      await this.writeConfig({ version: 1, rooms })
      this.rebuildIndex(rooms)
    })
  }

  async decryptApiToken(encryptedAiApiToken: string): Promise<string> {
    return decrypt(encryptedAiApiToken, this.encryptionKeyHex)
  }

  async decryptWebhookSecret(encryptedWebhookSecret: string): Promise<string> {
    return decrypt(encryptedWebhookSecret, this.encryptionKeyHex)
  }

  private allRooms(): RoomConfig[] {
    return Array.from(this.roomsById.values())
  }

  private async loadConfig(): Promise<RoomConfigFile> {
    try {
      const raw = await readFile(this.configPath, 'utf-8')
      return RoomConfigFileSchema.parse(JSON.parse(raw))
    } catch (error) {
      if (isEnoentError(error)) {
        const emptyConfig: RoomConfigFile = { version: 1, rooms: [] }
        await this.writeConfig(emptyConfig)
        return emptyConfig
      }

      throw new RoomConfigStoreError(
        `Failed to load room config store from ${this.configPath}: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_CONFIG_FILE',
      )
    }
  }

  private rebuildIndex(rooms: RoomConfig[]): void {
    this.roomsByOriginalId = new Map(rooms.map((room) => [room.originalRoomId, room]))
    this.roomsById = new Map(rooms.map((room) => [room.id, room]))
  }

  private async writeConfig(data: RoomConfigFile): Promise<void> {
    await this.writeAtomic(this.configPath, JSON.stringify(data, null, 2))
  }

  private async writeAtomic(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.tmp`
    await writeFile(tmpPath, content, 'utf-8')
    await rename(tmpPath, filePath)
  }

  private async withMutex<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireMutex()

    try {
      return await fn()
    } finally {
      this.releaseMutex()
    }
  }

  private acquireMutex(): Promise<void> {
    if (!this.mutex) {
      this.mutex = true
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      this.mutexQueue.push(resolve)
    })
  }

  private releaseMutex(): void {
    const next = this.mutexQueue.shift()
    if (next !== undefined) {
      next()
      return
    }

    this.mutex = false
  }
}
