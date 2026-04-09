import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FreeRoomConfigStore, FreeRoomConfigStoreError } from './free-room-config-store'

async function makeStore(dir: string): Promise<FreeRoomConfigStore> {
  const store = new FreeRoomConfigStore({ dataDir: dir })
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

describe('FreeRoomConfigStore', () => {
  let tmpDir: string
  let store: FreeRoomConfigStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'free-room-config-test-'))
    store = await makeStore(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('init() creates an empty free room store file', () => {
    expect(store.list()).toHaveLength(0)
  })

  it('init() fails fast with a clear error when free-room-configs.json is corrupt', async () => {
    await writeFile(join(tmpDir, 'free-room-configs.json'), '{ invalid json', 'utf-8')

    const brokenStore = new FreeRoomConfigStore({ dataDir: tmpDir })

    const error = await catchError(brokenStore.init())

    expect(error).toBeInstanceOf(FreeRoomConfigStoreError)
    expect((error as FreeRoomConfigStoreError).code).toBe('INVALID_CONFIG_FILE')
    expect((error as Error).message).toContain('free-room-configs.json')
  })

  it('create() stores a free room with id + timestamps', async () => {
    const room = await store.create({
      originalRoomId: 1001,
      originalRoomName: 'Test Free Room',
      destinationRoomId: 2001,
      destinationRoomName: 'Free Output Room',
      kagiStyle: 'Clear',
      context: 'support room',
    })

    expect(room.id).toMatch(/^[\da-f-]{36}$/iu)
    expect(room.originalRoomId).toBe(1001)
    expect(room.kagiStyle).toBe('Clear')
    expect(room.context).toBe('support room')
    expect(room.previewUrl).toBeDefined()
    expect(room.previewUrl).toMatch(/^https:\/\/translate\.kagi\.com\//)
    expect(room.previewUrl).toContain('text=hello')
    expect(room.previewUrl).toContain('context=support+room')
    expect(room.enabled).toBe(true)
    expect(room.createdAt).toBeTruthy()
    expect(room.updatedAt).toBe(room.createdAt)
  })

  it('create() includes previewUrl without context when null', async () => {
    const room = await store.create({
      originalRoomId: 888,
      originalRoomName: 'Test Room 2',
      destinationRoomId: 777,
      destinationRoomName: 'Test Room 2 VN',
      kagiStyle: 'Clear',
      context: null,
    })

    expect(room.previewUrl).toBeDefined()
    expect(room.previewUrl).toMatch(/^https:\/\/translate\.kagi\.com\//)
    expect(room.previewUrl).not.toMatch(/[?&]context=/)
  })

  it('create() throws duplicate error on duplicate originalRoomId inside the free store', async () => {
    await store.create({
      originalRoomId: 1001,
      originalRoomName: 'Test Free Room',
      destinationRoomId: 2001,
      destinationRoomName: 'Free Output Room',
      kagiStyle: 'Clear',
    })

    const error = await catchError(
      store.create({
        originalRoomId: 1001,
        originalRoomName: 'Test Free Room',
        destinationRoomId: 3001,
        destinationRoomName: 'Other Free Room',
        kagiStyle: 'Wild',
      }),
    )

    expect(error).toBeInstanceOf(FreeRoomConfigStoreError)
    expect((error as FreeRoomConfigStoreError).code).toBe('DUPLICATE_ORIGINAL_ROOM_ID')
  })

  it('getById() returns room by UUID', async () => {
    const created = await store.create({
      originalRoomId: 1001,
      originalRoomName: 'Test Free Room',
      destinationRoomId: 2001,
      destinationRoomName: 'Free Output Room',
      kagiStyle: 'Smart',
    })

    const fetched = store.getById(created.id)

    expect(fetched).not.toBeNull()
    expect(fetched?.id).toBe(created.id)
    expect(fetched?.kagiStyle).toBe('Smart')
  })

  it('getByOriginalRoomId() returns room by sourceRoomId', async () => {
    await store.create({
      originalRoomId: 5555,
      originalRoomName: 'Test Free Room',
      destinationRoomId: 6666,
      destinationRoomName: 'Free Room',
      kagiStyle: 'Fine',
    })

    const found = store.getByOriginalRoomId(5555)

    expect(found).not.toBeNull()
    expect(found?.originalRoomId).toBe(5555)
  })

  it('update() modifies fields and bumps updatedAt', async () => {
    const created = await store.create({
      originalRoomId: 1001,
      originalRoomName: 'Test Free Room',
      destinationRoomId: 2001,
      destinationRoomName: 'Free Output Room',
      kagiStyle: 'Clear',
    })

    await Bun.sleep(5)

    const updated = await store.update(created.id, {
      destinationRoomName: 'Free Output Room 2',
      kagiStyle: 'True',
      context: 'new context',
    })

    expect(updated.destinationRoomName).toBe('Free Output Room 2')
    expect(updated.kagiStyle).toBe('True')
    expect(updated.context).toBe('new context')
    expect(updated.previewUrl).toBeDefined()
    expect(updated.previewUrl).toContain('style=literal')
    expect(updated.previewUrl).toContain('context=new+context')
    expect(updated.updatedAt).not.toBe(created.updatedAt)
  })

  it('update() recomputes previewUrl when kagiStyle changes', async () => {
    const created = await store.create({
      originalRoomId: 1111,
      originalRoomName: 'Test Room',
      destinationRoomId: 2222,
      destinationRoomName: 'Output',
      kagiStyle: 'Clear',
      context: 'team',
    })

    const updated = await store.update(created.id, {
      kagiStyle: 'Wild',
    })

    expect(updated.previewUrl).not.toBe(created.previewUrl)
    expect(updated.previewUrl).toContain('formality=less')
    expect(updated.previewUrl).toContain('language_complexity=c2')
    expect(updated.previewUrl).toContain('context=team')
  })

  it('update() recomputes previewUrl when context changes', async () => {
    const created = await store.create({
      originalRoomId: 2222,
      originalRoomName: 'Test Room',
      destinationRoomId: 3333,
      destinationRoomName: 'Output',
      kagiStyle: 'Clear',
      context: 'old context',
    })

    const updated = await store.update(created.id, {
      context: 'new context',
    })

    expect(updated.previewUrl).not.toBe(created.previewUrl)
    expect(updated.previewUrl).toContain('context=new+context')
    expect(updated.previewUrl).not.toContain('old+context')
  })

  it('update() removes context from previewUrl when set to null', async () => {
    const created = await store.create({
      originalRoomId: 3333,
      originalRoomName: 'Test Room',
      destinationRoomId: 4444,
      destinationRoomName: 'Output',
      kagiStyle: 'Smart',
      context: 'has context',
    })

    const updated = await store.update(created.id, {
      context: null,
    })

    expect(updated.previewUrl).not.toBe(created.previewUrl)
    expect(updated.previewUrl).not.toMatch(/[?&]context=/)
  })

  it('setEnabled() changes enabled flag', async () => {
    const created = await store.create({
      originalRoomId: 1001,
      originalRoomName: 'Test Free Room',
      destinationRoomId: 2001,
      destinationRoomName: 'Free Output Room',
      kagiStyle: 'Clear',
    })

    const enabled = await store.setEnabled(created.id, true)
    expect(enabled.enabled).toBe(true)

    const disabled = await store.setEnabled(created.id, false)
    expect(disabled.enabled).toBe(false)
  })

  it('delete() removes room from the store', async () => {
    const created = await store.create({
      originalRoomId: 1001,
      originalRoomName: 'Test Free Room',
      destinationRoomId: 2001,
      destinationRoomName: 'Free Output Room',
      kagiStyle: 'Clear',
    })

    await store.delete(created.id)

    expect(store.getById(created.id)).toBeNull()
    expect(store.list()).toHaveLength(0)
  })

  it('persists atomic writes that reload cleanly from disk', async () => {
    await store.create({
      originalRoomId: 1001,
      originalRoomName: 'Test Free Room',
      destinationRoomId: 2001,
      destinationRoomName: 'Free Output Room',
      kagiStyle: 'Easy',
      protectedKeywords: [{ keyword: 'Acme', category: 'company' }],
    })

    const filePath = join(tmpDir, 'free-room-configs.json')
    const saved = JSON.parse(await readFile(filePath, 'utf-8')) as { version: number; rooms: [] }

    expect(saved.version).toBe(1)
    expect(saved.rooms).toHaveLength(1)

    const reloaded = await makeStore(tmpDir)
    expect(reloaded.list()).toHaveLength(1)
    expect(reloaded.list()[0]?.kagiStyle).toBe('Easy')
    expect(reloaded.list()[0]?.protectedKeywords).toEqual([
      { keyword: 'Acme', category: 'company' },
    ])
  })
})
