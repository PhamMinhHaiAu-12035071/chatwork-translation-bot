import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RoomConfigStore, RoomConfigStoreError } from './room-config-store'

const KEY_HEX = 'a'.repeat(64)

async function makeStore(dir: string): Promise<RoomConfigStore> {
  const store = new RoomConfigStore({
    dataDir: dir,
    encryptionKeyHex: KEY_HEX,
  })
  await store.init()
  return store
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
    return undefined
  } catch (error) {
    return error
  }
}

describe('RoomConfigStore', () => {
  let tmpDir: string
  let store: RoomConfigStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'room-config-test-'))
    store = await makeStore(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('init() creates an empty store file', () => {
    const rooms = store.list()
    expect(rooms).toHaveLength(0)
  })

  it('init() fails fast with a clear error when room-configs.json is corrupt', async () => {
    await writeFile(join(tmpDir, 'room-configs.json'), '{ definitely-not-valid-json }', 'utf-8')

    const brokenStore = new RoomConfigStore({
      dataDir: tmpDir,
      encryptionKeyHex: KEY_HEX,
    })

    const error = await catchError(brokenStore.init())

    expect(error).toBeInstanceOf(RoomConfigStoreError)
    expect((error as RoomConfigStoreError).code).toBe('INVALID_CONFIG_FILE')
    expect((error as Error).message).toContain('room-configs.json')
  })

  it('create() stores a room and returns it with id + timestamps', async () => {
    const room = await store.create({
      originalRoomId: 1001,
      destinationRoomId: 2001,
      destinationRoomName: 'Output Room',
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'raw-token',
      webhookSecret: 'raw-secret',
    })

    expect(room.id).toMatch(/^[\da-f-]{36}$/iu)
    expect(room.originalRoomId).toBe(1001)
    expect(room.enabled).toBe(true)
    expect(room.createdAt).toBeTruthy()
    expect(room.updatedAt).toBe(room.createdAt)
    expect(room.encryptedAiApiToken).not.toBe('raw-token')
    expect(room.encryptedWebhookSecret).not.toBe('raw-secret')
  })

  it('create() throws duplicate error on duplicate originalRoomId', async () => {
    await store.create({
      originalRoomId: 1001,
      destinationRoomId: 2001,
      destinationRoomName: 'Output Room',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'token',
      webhookSecret: 'secret',
    })

    const error = await catchError(
      store.create({
        originalRoomId: 1001,
        destinationRoomId: 3001,
        destinationRoomName: 'Other Room',
        aiProvider: 'gemini',
        aiModel: null,
        translationStyle: 'AUTO_CONTEXT',
        aiApiToken: 'token2',
        webhookSecret: 'secret2',
      }),
    )

    expect(error).toBeInstanceOf(RoomConfigStoreError)
    expect((error as RoomConfigStoreError).code).toBe('DUPLICATE_ORIGINAL_ROOM_ID')
  })

  it('getById() returns room by UUID with secrets redacted', async () => {
    const created = await store.create({
      originalRoomId: 1001,
      destinationRoomId: 2001,
      destinationRoomName: 'Room',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'token',
      webhookSecret: 'secret',
    })

    const fetched = store.getById(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.id).toBe(created.id)
    expect(fetched).not.toHaveProperty('encryptedAiApiToken')
    expect(fetched).not.toHaveProperty('encryptedWebhookSecret')
  })

  it('getByOriginalRoomId() returns room by sourceRoomId', async () => {
    await store.create({
      originalRoomId: 5555,
      destinationRoomId: 6666,
      destinationRoomName: 'Room',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'token',
      webhookSecret: 'secret',
    })

    const found = store.getByOriginalRoomId(5555)
    expect(found).not.toBeNull()
    expect(found?.originalRoomId).toBe(5555)
  })

  it('update() modifies fields and bumps updatedAt', async () => {
    const created = await store.create({
      originalRoomId: 1001,
      destinationRoomId: 2001,
      destinationRoomName: 'Room',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'token',
      webhookSecret: 'secret',
    })

    await Bun.sleep(5)

    const updated = await store.update(created.id, { translationStyle: 'TECHNICAL' })
    expect(updated.translationStyle).toBe('TECHNICAL')
    expect(updated.updatedAt).not.toBe(created.updatedAt)
  })

  it('setEnabled() changes enabled flag', async () => {
    const created = await store.create({
      originalRoomId: 1001,
      destinationRoomId: 2001,
      destinationRoomName: 'Room',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'token',
      webhookSecret: 'secret',
    })

    const enabled = await store.setEnabled(created.id, true)
    expect(enabled.enabled).toBe(true)

    const disabled = await store.setEnabled(created.id, false)
    expect(disabled.enabled).toBe(false)
  })

  it('delete() removes room and archives it', async () => {
    const created = await store.create({
      originalRoomId: 1001,
      destinationRoomId: 2001,
      destinationRoomName: 'Room',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'token',
      webhookSecret: 'secret',
    })

    await store.delete(created.id)

    const found = store.getById(created.id)
    expect(found).toBeNull()
    expect(store.list()).toHaveLength(0)

    const archivePath = join(tmpDir, 'room-configs-archive.json')
    const archiveError = await catchError(access(archivePath))
    expect(archiveError).toBeInstanceOf(Error)
  })

  it('decryptApiToken() returns the original plaintext token', async () => {
    const created = await store.create({
      originalRoomId: 1001,
      destinationRoomId: 2001,
      destinationRoomName: 'Room',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'my-real-openai-token',
      webhookSecret: 'secret',
    })

    const decrypted = await store.decryptApiToken(created.encryptedAiApiToken)
    expect(decrypted).toBe('my-real-openai-token')
  })

  it('decryptWebhookSecret() returns the original plaintext secret', async () => {
    const created = await store.create({
      originalRoomId: 1001,
      destinationRoomId: 2001,
      destinationRoomName: 'Room',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'token',
      webhookSecret: 'my-real-webhook-secret',
    })

    const decrypted = await store.decryptWebhookSecret(created.encryptedWebhookSecret)
    expect(decrypted).toBe('my-real-webhook-secret')
  })

  it('persists data across store re-instantiation', async () => {
    await store.create({
      originalRoomId: 1001,
      destinationRoomId: 2001,
      destinationRoomName: 'Room',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'token',
      webhookSecret: 'secret',
    })

    const store2 = await makeStore(tmpDir)
    const rooms = store2.list()
    expect(rooms).toHaveLength(1)
    expect(rooms[0]?.originalRoomId).toBe(1001)
  })
})
