import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { buildPreviewUrl } from '@chatwork-bot/provider-kagi'
import { FreeRoomConfigFileSchema } from '~/types/free-room-config'
import type {
  CreateFreeRoomRequest,
  FreeRoomConfig,
  FreeRoomConfigFile,
  UpdateFreeRoomRequest,
} from '~/types/free-room-config'

export class FreeRoomConfigStoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'FreeRoomConfigStoreError'
  }
}

interface FreeRoomConfigStoreOptions {
  dataDir: string
}

interface CreateFreeRoomStoreParams extends Omit<CreateFreeRoomRequest, 'context'> {
  destinationRoomId: number
  context?: string | null
}

function isEnoentError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

export class FreeRoomConfigStore {
  private readonly configPath: string
  private roomsByOriginalId = new Map<number, FreeRoomConfig>()
  private roomsById = new Map<string, FreeRoomConfig>()
  private mutex = false
  private readonly mutexQueue: (() => void)[] = []

  constructor(options: FreeRoomConfigStoreOptions) {
    this.configPath = join(options.dataDir, 'free-room-configs.json')
  }

  async init(): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true })

    const data = await this.loadConfig()
    this.rebuildIndex(data.rooms)
  }

  list(): FreeRoomConfig[] {
    return Array.from(this.roomsById.values())
  }

  getById(id: string): FreeRoomConfig | null {
    return this.roomsById.get(id) ?? null
  }

  getByOriginalRoomId(originalRoomId: number): FreeRoomConfig | null {
    return this.roomsByOriginalId.get(originalRoomId) ?? null
  }

  async create(params: CreateFreeRoomStoreParams): Promise<FreeRoomConfig> {
    return this.withMutex(async () => {
      if (this.roomsByOriginalId.has(params.originalRoomId)) {
        throw new FreeRoomConfigStoreError(
          `originalRoomId ${params.originalRoomId.toString()} already exists`,
          'DUPLICATE_ORIGINAL_ROOM_ID',
        )
      }

      const now = new Date().toISOString()
      const previewUrl = buildPreviewUrl(params.kagiStyle, params.context)

      const room: FreeRoomConfig = {
        id: crypto.randomUUID(),
        originalRoomId: params.originalRoomId,
        originalRoomName: params.originalRoomName,
        destinationRoomId: params.destinationRoomId,
        destinationRoomName: params.destinationRoomName,
        kagiStyle: params.kagiStyle,
        context: params.context ?? null,
        previewUrl,
        ...(params.protectedKeywords !== undefined
          ? { protectedKeywords: params.protectedKeywords }
          : {}),
        enabled: true,
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

  async update(id: string, patch: UpdateFreeRoomRequest): Promise<FreeRoomConfig> {
    return this.withMutex(async () => {
      const existing = this.roomsById.get(id)
      if (existing === undefined) {
        throw new FreeRoomConfigStoreError(`Room ${id} not found`, 'NOT_FOUND')
      }

      const updated: FreeRoomConfig = {
        ...existing,
        ...(patch.destinationRoomName !== undefined
          ? { destinationRoomName: patch.destinationRoomName }
          : {}),
        ...(patch.kagiStyle !== undefined ? { kagiStyle: patch.kagiStyle } : {}),
        ...(patch.context !== undefined ? { context: patch.context } : {}),
        ...(patch.protectedKeywords !== undefined
          ? { protectedKeywords: patch.protectedKeywords }
          : {}),
        updatedAt: new Date().toISOString(),
      }

      const previewUrl = buildPreviewUrl(updated.kagiStyle, updated.context)
      updated.previewUrl = previewUrl

      const rooms = this.allRooms().map((room) => (room.id === id ? updated : room))
      await this.writeConfig({ version: 1, rooms })
      this.rebuildIndex(rooms)

      return updated
    })
  }

  async setEnabled(id: string, enabled: boolean): Promise<FreeRoomConfig> {
    return this.withMutex(async () => {
      const existing = this.roomsById.get(id)
      if (existing === undefined) {
        throw new FreeRoomConfigStoreError(`Room ${id} not found`, 'NOT_FOUND')
      }

      const updated: FreeRoomConfig = {
        ...existing,
        enabled,
        updatedAt: new Date().toISOString(),
      }

      const rooms = this.allRooms().map((room) => (room.id === id ? updated : room))
      await this.writeConfig({ version: 1, rooms })
      this.rebuildIndex(rooms)

      return updated
    })
  }

  async delete(id: string): Promise<void> {
    return this.withMutex(async () => {
      const existing = this.roomsById.get(id)
      if (existing === undefined) {
        throw new FreeRoomConfigStoreError(`Room ${id} not found`, 'NOT_FOUND')
      }

      const rooms = this.allRooms().filter((room) => room.id !== id)
      await this.writeConfig({ version: 1, rooms })
      this.rebuildIndex(rooms)
    })
  }

  private allRooms(): FreeRoomConfig[] {
    return Array.from(this.roomsById.values())
  }

  private async loadConfig(): Promise<FreeRoomConfigFile> {
    try {
      const raw = await readFile(this.configPath, 'utf-8')
      return FreeRoomConfigFileSchema.parse(JSON.parse(raw))
    } catch (error) {
      if (isEnoentError(error)) {
        const emptyConfig: FreeRoomConfigFile = { version: 1, rooms: [] }
        await this.writeConfig(emptyConfig)
        return emptyConfig
      }

      throw new FreeRoomConfigStoreError(
        `Failed to load free room config store from ${this.configPath}: ${error instanceof Error ? error.message : String(error)}`,
        'INVALID_CONFIG_FILE',
      )
    }
  }

  private rebuildIndex(rooms: FreeRoomConfig[]): void {
    this.roomsByOriginalId = new Map(rooms.map((room) => [room.originalRoomId, room]))
    this.roomsById = new Map(rooms.map((room) => [room.id, room]))
  }

  private async writeConfig(data: FreeRoomConfigFile): Promise<void> {
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
