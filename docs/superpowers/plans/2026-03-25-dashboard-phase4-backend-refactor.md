# Dashboard Phase 4: Backend Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the translator and webhook-logger from single-room env-var config to a per-room JSON config store with CRUD API, AES-256-GCM encrypted secrets, and per-request room config resolution in the translation handler.

**Architecture:** A new `RoomConfigStore` service in the translator manages a JSON file (`data/room-configs.json`) with an in-memory Map for O(1) lookup, protected by a mutex for atomic writes. The webhook handler resolves room config by `sourceRoomId` on every request instead of reading global env vars. The webhook-logger fetches the HMAC secret for each incoming webhook from the translator's new `GET /internal/room-secret` endpoint so per-room secrets replace the single `CHATWORK_WEBHOOK_SECRET`.

**Tech Stack:** Bun v1.1+, TypeScript 5.4+ strict, Elysia, Zod, bun:test, Web Crypto API (AES-256-GCM)

**Spec:** `docs/superpowers/specs/2026-03-25-dashboard-multi-room-design.md`

**Ship & Review:** `bun test` — all tests pass, coverage >95% for new code; `bun run typecheck && bun run lint` — zero errors

---

## Breaking Changes Summary

| Removed env var                | Package        | Replacement                                                 |
| ------------------------------ | -------------- | ----------------------------------------------------------- |
| `AI_PROVIDER`                  | translator     | stored per-room in `RoomConfig.aiProvider`                  |
| `AI_MODEL`                     | translator     | stored per-room in `RoomConfig.aiModel`                     |
| `AI_TRANSLATION_STYLE`         | translator     | stored per-room in `RoomConfig.translationStyle`            |
| `CHATWORK_DESTINATION_ROOM_ID` | translator     | stored per-room in `RoomConfig.destinationRoomId`           |
| `CHATWORK_WEBHOOK_SECRET`      | webhook-logger | fetched per-request from translator `/internal/room-secret` |

| Added env var                | Package                     | Purpose                                   |
| ---------------------------- | --------------------------- | ----------------------------------------- |
| `ROOM_CONFIG_ENCRYPTION_KEY` | translator                  | 32-byte hex key for AES-256-GCM           |
| `INTERNAL_API_SECRET`        | translator + webhook-logger | shared secret for `/internal/*` endpoints |
| `TRANSLATOR_INTERNAL_URL`    | webhook-logger              | URL of translator for internal calls      |

---

## File Map

| File                                                          | Action | Responsibility                                    |
| ------------------------------------------------------------- | ------ | ------------------------------------------------- |
| `packages/chatwork/src/interfaces/chatwork-api.ts`            | Modify | Add `createRoom` method signature                 |
| `packages/chatwork/src/http/chatwork-api-client.ts`           | Modify | Implement `createRoom`                            |
| `packages/chatwork/src/services/create-room.ts`               | Create | Thin service wrapper                              |
| `packages/chatwork/src/services/create-room.test.ts`          | Create | Unit tests                                        |
| `packages/chatwork/src/types/room.ts`                         | Modify | Add `CreateRoomParams` + `CreateRoomResult` types |
| `packages/chatwork/src/index.ts`                              | Modify | Export `createRoom` and new types                 |
| `packages/translator/src/utils/encryption.ts`                 | Create | AES-256-GCM encrypt/decrypt                       |
| `packages/translator/src/utils/encryption.test.ts`            | Create | Unit tests                                        |
| `packages/translator/src/types/room-config.ts`                | Create | `RoomConfig` interface + Zod schema               |
| `packages/translator/src/services/room-config-store.ts`       | Create | CRUD + in-memory Map + mutex + file I/O           |
| `packages/translator/src/services/room-config-store.test.ts`  | Create | Unit tests                                        |
| `packages/translator/src/routes/rooms.ts`                     | Create | CRUD API endpoints `/api/rooms`                   |
| `packages/translator/src/routes/rooms.test.ts`                | Create | Integration tests                                 |
| `packages/translator/src/routes/providers.ts`                 | Create | `GET /api/providers`                              |
| `packages/translator/src/routes/providers.test.ts`            | Create | Unit tests                                        |
| `packages/translator/src/routes/internal-room-secret.ts`      | Create | `GET /internal/room-secret`                       |
| `packages/translator/src/routes/internal-room-secret.test.ts` | Create | Unit tests                                        |
| `packages/translator/src/webhook/handler.ts`                  | Modify | Per-room config resolution                        |
| `packages/translator/src/webhook/handler.test.ts`             | Modify | Update tests for per-room flow                    |
| `packages/translator/src/env-schema.ts`                       | Modify | Remove old vars, add new vars                     |
| `packages/translator/src/env.test.ts`                         | Modify | Update env tests                                  |
| `packages/translator/src/bootstrap/startup-guards.ts`         | Modify | Remove provider env checks                        |
| `packages/translator/src/bootstrap/startup-guards.test.ts`    | Modify | Update tests                                      |
| `packages/translator/src/bootstrap/startup-banner.ts`         | Modify | Remove provider/style from banner                 |
| `packages/translator/src/bootstrap/startup-banner.test.ts`    | Modify | Update tests                                      |
| `packages/translator/src/index.ts`                            | Modify | Remove provider startup code                      |
| `packages/translator/src/app.ts`                              | Modify | Register new routes + CORS                        |
| `packages/webhook-logger/src/env.ts`                          | Modify | Remove old vars, add new vars                     |
| `packages/webhook-logger/src/routes/webhook.ts`               | Modify | Per-room secret fetch                             |
| `packages/webhook-logger/src/routes/webhook.test.ts`          | Modify | Update tests                                      |

---

## Task 1: Add `createRoom` to the chatwork package

**Files:**

- Modify: `packages/chatwork/src/types/room.ts`
- Modify: `packages/chatwork/src/interfaces/chatwork-api.ts`
- Modify: `packages/chatwork/src/http/chatwork-api-client.ts`
- Create: `packages/chatwork/src/services/create-room.ts`
- Create: `packages/chatwork/src/services/create-room.test.ts`
- Modify: `packages/chatwork/src/index.ts`

- [ ] **Step 1: Add types to `packages/chatwork/src/types/room.ts`**

```typescript
export interface Room {
  room_id: number
  name: string
}

export interface CreateRoomParams {
  name: string
  /** Comma-separated list of account IDs for admins */
  members_admin_ids: string
  description?: string
  icon_preset?: string
}

export interface CreateRoomResult {
  room_id: number
}
```

- [ ] **Step 2: Add `createRoom` to `packages/chatwork/src/interfaces/chatwork-api.ts`**

```typescript
import type { ChatworkMember, ChatworkMessage, ChatworkSendMessageResult } from '~/types/message'
import type { Room, CreateRoomParams, CreateRoomResult } from '~/types/room'

export interface IChatworkApiClient {
  sendRoomMessage(
    roomId: number,
    message: string,
    token: string,
  ): Promise<ChatworkSendMessageResult>

  deleteRoomMessage(roomId: number, messageId: string, token: string): Promise<void>

  getRoomMembers(roomId: number, token: string): Promise<ChatworkMember[]>

  getRoomMessage(roomId: number, messageId: string, token: string): Promise<ChatworkMessage>

  listRoomMessages(roomId: number, token: string, force?: boolean): Promise<ChatworkMessage[]>

  getRoom(roomId: number, token: string): Promise<Room>

  createRoom(params: CreateRoomParams, token: string): Promise<CreateRoomResult>
}
```

- [ ] **Step 3: Implement `createRoom` in `packages/chatwork/src/http/chatwork-api-client.ts`**

Add after the `getRoom` method (before the closing `} satisfies IChatworkApiClient`):

```typescript
  async createRoom(params: CreateRoomParams, token: string): Promise<CreateRoomResult> {
    const url = `${BASE_URL}/rooms`
    const body = new URLSearchParams()
    body.set('name', params.name)
    body.set('members_admin_ids', params.members_admin_ids)
    if (params.description !== undefined) {
      body.set('description', params.description)
    }
    if (params.icon_preset !== undefined) {
      body.set('icon_preset', params.icon_preset)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...makeHeaders(token),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      return handleErrorResponse(response)
    }

    return (await response.json()) as CreateRoomResult
  },
```

Also add `CreateRoomParams` and `CreateRoomResult` to the import at the top:

```typescript
import type { Room, CreateRoomParams, CreateRoomResult } from '~/types/room'
```

- [ ] **Step 4: Create `packages/chatwork/src/services/create-room.ts`**

```typescript
import { chatworkApiClient } from '~/http/chatwork-api-client'
import type { CreateRoomParams, CreateRoomResult } from '~/types/room'

export async function createRoom(
  params: CreateRoomParams,
  token: string,
): Promise<CreateRoomResult> {
  return chatworkApiClient.createRoom(params, token)
}
```

- [ ] **Step 5: Create `packages/chatwork/src/services/create-room.test.ts`**

```typescript
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { ChatworkApiError } from '~/errors/chatwork-api-error'
import { createRoom } from './create-room'

type FetchSpy = ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

function makeFetchSpy(): FetchSpy {
  return spyOn(globalThis, 'fetch').mockImplementation((() => {
    throw new Error('Unexpected real HTTP call')
  }) as unknown as typeof fetch)
}

function mockOnce(spy: FetchSpy, response: Response): void {
  spy.mockImplementationOnce((() => Promise.resolve(response)) as unknown as typeof fetch)
}

const TOKEN = 'test-token'
const PARAMS = { name: 'Translation Output', members_admin_ids: '123' }

describe('createRoom', () => {
  let fetchSpy: FetchSpy

  beforeEach(() => {
    fetchSpy = makeFetchSpy()
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('calls POST /rooms with correct headers and body', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ room_id: 999 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await createRoom(PARAMS, TOKEN)

    expect(result).toEqual({ room_id: 999 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.chatwork.com/v2/rooms')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-ChatWorkToken']).toBe(TOKEN)

    const body = new URLSearchParams(init.body as string)
    expect(body.get('name')).toBe('Translation Output')
    expect(body.get('members_admin_ids')).toBe('123')
  })

  it('includes optional description when provided', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ room_id: 999 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await createRoom({ ...PARAMS, description: 'My room desc' }, TOKEN)

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(init.body as string)
    expect(body.get('description')).toBe('My room desc')
  })

  it('throws ChatworkApiError on non-OK response', async () => {
    mockOnce(
      fetchSpy,
      new Response(JSON.stringify({ errors: ['Forbidden'] }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(createRoom(PARAMS, TOKEN)).rejects.toBeInstanceOf(ChatworkApiError)
  })
})
```

- [ ] **Step 6: Export from `packages/chatwork/src/index.ts`**

Add to the types section and services section:

```typescript
export type { Room, CreateRoomParams, CreateRoomResult } from '~/types/room'
// ...
export { createRoom } from '~/services/create-room'
```

- [ ] **Step 7: Run tests**

```bash
bun test packages/chatwork/src/services/create-room.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/chatwork/src/types/room.ts packages/chatwork/src/interfaces/chatwork-api.ts packages/chatwork/src/http/chatwork-api-client.ts packages/chatwork/src/services/create-room.ts packages/chatwork/src/services/create-room.test.ts packages/chatwork/src/index.ts
git commit -m "feat(chatwork): add createRoom to IChatworkApiClient and implementation"
```

---

## Task 2: Create encryption utils (AES-256-GCM)

**Files:**

- Create: `packages/translator/src/utils/encryption.ts`
- Create: `packages/translator/src/utils/encryption.test.ts`

- [ ] **Step 1: Write failing tests first — create `packages/translator/src/utils/encryption.test.ts`**

```typescript
import { describe, expect, it } from 'bun:test'
import { decrypt, encrypt } from './encryption'

const KEY_HEX = 'a'.repeat(64) // 32 bytes hex

describe('encrypt / decrypt', () => {
  it('roundtrips plaintext through AES-256-GCM', async () => {
    const plaintext = 'super-secret-api-key'
    const ciphertext = await encrypt(plaintext, KEY_HEX)
    const result = await decrypt(ciphertext, KEY_HEX)
    expect(result).toBe(plaintext)
  })

  it('produces different ciphertext each invocation (random IV)', async () => {
    const plaintext = 'same text'
    const c1 = await encrypt(plaintext, KEY_HEX)
    const c2 = await encrypt(plaintext, KEY_HEX)
    expect(c1).not.toBe(c2)
  })

  it('decrypt throws on tampered ciphertext', async () => {
    const ciphertext = await encrypt('hello', KEY_HEX)
    const tampered = ciphertext.slice(0, -4) + 'XXXX'
    await expect(decrypt(tampered, KEY_HEX)).rejects.toThrow()
  })

  it('decrypt throws on wrong key', async () => {
    const ciphertext = await encrypt('hello', KEY_HEX)
    const wrongKey = 'b'.repeat(64)
    await expect(decrypt(ciphertext, wrongKey)).rejects.toThrow()
  })

  it('throws on key with wrong length', async () => {
    await expect(encrypt('hello', 'tooshort')).rejects.toThrow('ROOM_CONFIG_ENCRYPTION_KEY')
  })
})
```

- [ ] **Step 2: Implement `packages/translator/src/utils/encryption.ts`**

```typescript
// AES-256-GCM encryption utilities.
// Ciphertext format: base64url(iv[12] + ciphertext + authTag[16])
// The IV is randomly generated per encryption call, making each output unique.

const IV_LENGTH = 12 // bytes — AES-GCM standard
const KEY_HEX_LENGTH = 64 // 32 bytes expressed as hex

function validateKeyHex(keyHex: string): void {
  if (keyHex.length !== KEY_HEX_LENGTH) {
    throw new Error(
      `ROOM_CONFIG_ENCRYPTION_KEY must be exactly ${KEY_HEX_LENGTH.toString()} hex chars (32 bytes). Got ${keyHex.length.toString()}.`,
    )
  }
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  const keyBytes = Uint8Array.from(keyHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encrypt(plaintext: string, keyHex: string): Promise<string> {
  validateKeyHex(keyHex)
  const key = await importKey(keyHex)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(plaintext)

  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

  const combined = new Uint8Array(IV_LENGTH + ciphertextBuf.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertextBuf), IV_LENGTH)

  return Buffer.from(combined).toString('base64url')
}

export async function decrypt(ciphertextB64: string, keyHex: string): Promise<string> {
  validateKeyHex(keyHex)
  const key = await importKey(keyHex)
  const combined = Buffer.from(ciphertextB64, 'base64url')

  const iv = combined.subarray(0, IV_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH)

  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plainBuf)
}
```

- [ ] **Step 3: Run tests**

```bash
bun test packages/translator/src/utils/encryption.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/utils/encryption.ts packages/translator/src/utils/encryption.test.ts
git commit -m "feat(translator): add AES-256-GCM encryption utilities"
```

---

## Task 3: Define RoomConfig type and Zod schema

**Files:**

- Create: `packages/translator/src/types/room-config.ts`

- [ ] **Step 1: Create `packages/translator/src/types/room-config.ts`**

```typescript
import { z } from 'zod'

export const AI_PROVIDER_VALUES = ['openai', 'gemini'] as const
export type RoomAiProvider = (typeof AI_PROVIDER_VALUES)[number]

export const TRANSLATION_STYLE_VALUES_ROOM = [
  'AUTO_CONTEXT',
  'NATURAL_CASUAL',
  'PROFESSIONAL_BUSINESS',
  'TECHNICAL',
] as const
export type RoomTranslationStyle = (typeof TRANSLATION_STYLE_VALUES_ROOM)[number]

export const RoomConfigSchema = z.object({
  id: z.string().uuid(),
  originalRoomId: z.number().int().positive(),
  destinationRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1),
  aiProvider: z.enum(AI_PROVIDER_VALUES),
  aiModel: z.string().min(1).nullable(),
  translationStyle: z.enum(TRANSLATION_STYLE_VALUES_ROOM),
  encryptedAiApiToken: z.string().min(1),
  encryptedWebhookSecret: z.string().min(1),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type RoomConfig = z.infer<typeof RoomConfigSchema>

export const RoomConfigFileSchema = z.object({
  version: z.literal(1),
  rooms: z.array(RoomConfigSchema),
})

export type RoomConfigFile = z.infer<typeof RoomConfigFileSchema>

export const ArchivedRoomConfigSchema = RoomConfigSchema.extend({
  archivedAt: z.string().datetime(),
})

export type ArchivedRoomConfig = z.infer<typeof ArchivedRoomConfigSchema>

export const ArchiveFileSchema = z.object({
  archived: z.array(ArchivedRoomConfigSchema),
})

export type ArchiveFile = z.infer<typeof ArchiveFileSchema>

// --- API shapes (secrets redacted) ---

export type RoomConfigPublic = Omit<RoomConfig, 'encryptedAiApiToken' | 'encryptedWebhookSecret'>

export function redactRoomConfig(room: RoomConfig): RoomConfigPublic {
  const { encryptedAiApiToken: _a, encryptedWebhookSecret: _w, ...rest } = room
  return rest
}

// --- Request schemas ---

export const CreateRoomRequestSchema = z.object({
  originalRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1).max(128),
  aiProvider: z.enum(AI_PROVIDER_VALUES),
  aiModel: z.string().min(1).nullable().default(null),
  translationStyle: z.enum(TRANSLATION_STYLE_VALUES_ROOM).default('PROFESSIONAL_BUSINESS'),
  aiApiToken: z.string().min(1),
  webhookSecret: z.string().min(1),
})

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>

export const UpdateRoomRequestSchema = z.object({
  destinationRoomName: z.string().min(1).max(128).optional(),
  aiProvider: z.enum(AI_PROVIDER_VALUES).optional(),
  aiModel: z.string().min(1).nullable().optional(),
  translationStyle: z.enum(TRANSLATION_STYLE_VALUES_ROOM).optional(),
  aiApiToken: z.string().min(1).optional(),
  webhookSecret: z.string().min(1).optional(),
})

export type UpdateRoomRequest = z.infer<typeof UpdateRoomRequestSchema>
```

- [ ] **Step 2: Commit**

```bash
git add packages/translator/src/types/room-config.ts
git commit -m "feat(translator): add RoomConfig types and Zod schemas"
```

---

## Task 4: Create RoomConfigStore service

**Files:**

- Create: `packages/translator/src/services/room-config-store.ts`
- Create: `packages/translator/src/services/room-config-store.test.ts`

- [ ] **Step 1: Write failing tests first — create `packages/translator/src/services/room-config-store.test.ts`**

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RoomConfigStore } from './room-config-store'

const KEY_HEX = 'a'.repeat(64)

async function makeStore(dir: string): Promise<RoomConfigStore> {
  const store = new RoomConfigStore({
    dataDir: dir,
    encryptionKeyHex: KEY_HEX,
  })
  await store.init()
  return store
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

  it('init() creates an empty store file', async () => {
    const rooms = await store.list()
    expect(rooms).toHaveLength(0)
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

    expect(room.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(room.originalRoomId).toBe(1001)
    expect(room.enabled).toBe(false)
    expect(room.createdAt).toBeTruthy()
    expect(room.updatedAt).toBe(room.createdAt)
    // Tokens must be stored encrypted, not raw
    expect(room.encryptedAiApiToken).not.toBe('raw-token')
    expect(room.encryptedWebhookSecret).not.toBe('raw-secret')
  })

  it('create() throws 409 on duplicate originalRoomId', async () => {
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

    await expect(
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
    ).rejects.toMatchObject({ code: 'DUPLICATE_ORIGINAL_ROOM_ID' })
  })

  it('getById() returns room by UUID', async () => {
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

    const fetched = await store.getById(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(created.id)
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
    expect(found!.originalRoomId).toBe(5555)
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

    const found = await store.getById(created.id)
    expect(found).toBeNull()

    const rooms = await store.list()
    expect(rooms).toHaveLength(0)
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
    const rooms = await store2.list()
    expect(rooms).toHaveLength(1)
    expect(rooms[0].originalRoomId).toBe(1001)
  })
})
```

- [ ] **Step 2: Implement `packages/translator/src/services/room-config-store.ts`**

```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { encrypt, decrypt } from '~/utils/encryption'
import { RoomConfigFileSchema, ArchiveFileSchema, redactRoomConfig } from '~/types/room-config'
import type {
  RoomConfig,
  RoomConfigFile,
  ArchiveFile,
  RoomConfigPublic,
  CreateRoomRequest,
  UpdateRoomRequest,
} from '~/types/room-config'

// ─── Errors ────────────────────────────────────────────────────────────────────

export class RoomConfigStoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'RoomConfigStoreError'
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CreateRoomStoreParams extends CreateRoomRequest {
  destinationRoomId: number
}

interface RoomConfigStoreOptions {
  dataDir: string
  encryptionKeyHex: string
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export class RoomConfigStore {
  private readonly configPath: string
  private readonly archivePath: string
  private readonly encryptionKeyHex: string
  private roomsByOriginalId: Map<number, RoomConfig> = new Map()
  private roomsById: Map<string, RoomConfig> = new Map()
  private mutex = false
  private mutexQueue: Array<() => void> = []

  constructor(options: RoomConfigStoreOptions) {
    this.configPath = join(options.dataDir, 'room-configs.json')
    this.archivePath = join(options.dataDir, 'room-configs-archive.json')
    this.encryptionKeyHex = options.encryptionKeyHex
  }

  async init(): Promise<void> {
    await mkdir(join(this.configPath, '..'), { recursive: true })
    let data: RoomConfigFile
    try {
      const raw = await readFile(this.configPath, 'utf-8')
      data = RoomConfigFileSchema.parse(JSON.parse(raw))
    } catch {
      data = { version: 1, rooms: [] }
      await this.writeConfig(data)
    }
    this.rebuildIndex(data.rooms)
  }

  list(): RoomConfigPublic[] {
    return Array.from(this.roomsById.values()).map(redactRoomConfig)
  }

  async getById(id: string): Promise<RoomConfigPublic | null> {
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

      const rooms = this.allRooms().map((r) => (r.id === id ? updated : r))
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

      const rooms = this.allRooms().map((r) => (r.id === id ? updated : r))
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

      // Archive before deleting
      let archiveData: ArchiveFile
      try {
        const raw = await readFile(this.archivePath, 'utf-8')
        archiveData = ArchiveFileSchema.parse(JSON.parse(raw))
      } catch {
        archiveData = { archived: [] }
      }

      archiveData.archived.push({ ...existing, archivedAt: new Date().toISOString() })
      await this.writeAtomic(this.archivePath, JSON.stringify(archiveData, null, 2))

      const rooms = this.allRooms().filter((r) => r.id !== id)
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

  // ─── Private ───────────────────────────────────────────────────────────────

  private allRooms(): RoomConfig[] {
    return Array.from(this.roomsById.values())
  }

  private rebuildIndex(rooms: RoomConfig[]): void {
    this.roomsByOriginalId = new Map(rooms.map((r) => [r.originalRoomId, r]))
    this.roomsById = new Map(rooms.map((r) => [r.id, r]))
  }

  private async writeConfig(data: RoomConfigFile): Promise<void> {
    await this.writeAtomic(this.configPath, JSON.stringify(data, null, 2))
  }

  private async writeAtomic(filePath: string, content: string): Promise<void> {
    const tmp = `${filePath}.tmp`
    await writeFile(tmp, content, 'utf-8')
    await Bun.file(tmp).exists() // flush
    // Bun doesn't expose rename directly; use Node fs.rename via shell or writeFile
    // In Bun, we can use the file system module:
    const { rename } = await import('node:fs/promises')
    await rename(tmp, filePath)
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
    } else {
      this.mutex = false
    }
  }
}
```

- [ ] **Step 3: Run tests**

```bash
bun test packages/translator/src/services/room-config-store.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/types/room-config.ts packages/translator/src/services/room-config-store.ts packages/translator/src/services/room-config-store.test.ts
git commit -m "feat(translator): add RoomConfigStore with CRUD, mutex, and AES-256-GCM encryption"
```

---

## Task 5: Update translator env schema

**Files:**

- Modify: `packages/translator/src/env-schema.ts`
- Modify: `packages/translator/src/env.test.ts` (if exists)

- [ ] **Step 1: Rewrite `packages/translator/src/env-schema.ts`**

```typescript
import { z } from 'zod'
import { DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS } from '~/services/pipeline-timeout'

export const translatorEnvSchema = z.object({
  CHATWORK_API_TOKEN: z.string().min(1, 'CHATWORK_API_TOKEN is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  ROOM_CONFIG_ENCRYPTION_KEY: z
    .string()
    .length(64, 'ROOM_CONFIG_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),
  INTERNAL_API_SECRET: z.string().min(1, 'INTERNAL_API_SECRET is required'),
  ROOM_CONFIG_DATA_DIR: z.string().default('./data'),
  TRANSLATOR_PHASE_HEARTBEAT_MS: z.coerce.number().int().positive().default(30_000),
  TRANSLATOR_TRANSLATION_BUDGET_MS: z.coerce.number().int().positive().default(60_000),
  TRANSLATOR_DELIVERY_BUDGET_MS: z.coerce.number().int().positive().default(45_000),
  TRANSLATOR_ACK_CALLBACK_BUDGET_MS: z.coerce.number().int().positive().default(10_000),
  TRANSLATOR_PIPELINE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS),
  TRANSLATOR_STATUS_HISTORY_LIMIT: z.coerce.number().int().positive().default(20),
})

export function parseTranslatorEnv(input: NodeJS.ProcessEnv) {
  const result = translatorEnvSchema.safeParse(input)

  if (!result.success) {
    console.error('[env] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}
```

- [ ] **Step 2: Update `packages/translator/src/env.test.ts` to match new schema**

Read the current test file and update all assertions that reference removed fields (`AI_PROVIDER`, `AI_MODEL`, `AI_TRANSLATION_STYLE`, `CHATWORK_DESTINATION_ROOM_ID`) to test the new required fields (`ROOM_CONFIG_ENCRYPTION_KEY`, `INTERNAL_API_SECRET`) instead.

- [ ] **Step 3: Run env tests**

```bash
bun test packages/translator/src/env.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/env-schema.ts packages/translator/src/env.test.ts
git commit -m "refactor(translator): remove single-room env vars, add ROOM_CONFIG_ENCRYPTION_KEY and INTERNAL_API_SECRET"
```

---

## Task 6: Create room CRUD API routes

**Files:**

- Create: `packages/translator/src/routes/rooms.ts`
- Create: `packages/translator/src/routes/rooms.test.ts`

- [ ] **Step 1: Write failing tests first — create `packages/translator/src/routes/rooms.test.ts`**

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Elysia } from 'elysia'
import { createRoomsRoutes } from './rooms'
import { RoomConfigStore } from '~/services/room-config-store'
import { createRoom as createChatworkRoom } from '@chatwork-bot/chatwork'

// Mock the chatwork createRoom to avoid real API calls
import { mock } from 'bun:test'
mock.module('@chatwork-bot/chatwork', () => ({
  createRoom: async () => ({ room_id: 99001 }),
  // re-export other things needed
}))

const KEY_HEX = 'a'.repeat(64)
const INTERNAL_SECRET = 'test-internal-secret'
const API_TOKEN = 'test-chatwork-token'

async function buildApp(dataDir: string) {
  const store = new RoomConfigStore({ dataDir, encryptionKeyHex: KEY_HEX })
  await store.init()
  const routes = createRoomsRoutes({ store, chatworkApiToken: API_TOKEN })
  return new Elysia().use(routes)
}

const VALID_BODY = {
  originalRoomId: 1001,
  destinationRoomName: 'Translation Output',
  aiProvider: 'openai',
  aiModel: 'gpt-4o',
  translationStyle: 'PROFESSIONAL_BUSINESS',
  aiApiToken: 'sk-openai-key',
  webhookSecret: 'webhook-secret-abc',
}

describe('GET /api/rooms', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rooms-test-'))
  })
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty array when no rooms', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(new Request('http://localhost/api/rooms'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { rooms: unknown[] }
    expect(body.rooms).toHaveLength(0)
  })

  it('returns rooms with secrets redacted', async () => {
    const app = await buildApp(tmpDir)

    await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )

    const response = await app.handle(new Request('http://localhost/api/rooms'))
    const body = (await response.json()) as { rooms: Array<Record<string, unknown>> }
    expect(body.rooms).toHaveLength(1)
    expect(body.rooms[0]).not.toHaveProperty('encryptedAiApiToken')
    expect(body.rooms[0]).not.toHaveProperty('encryptedWebhookSecret')
  })
})

describe('POST /api/rooms', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rooms-test-'))
  })
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates a room and returns 201 with webhook URL', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    expect(response.status).toBe(201)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toHaveProperty('room')
    expect(body).toHaveProperty('webhookUrl')
    expect((body.room as Record<string, unknown>).enabled).toBe(false)
  })

  it('returns 409 on duplicate originalRoomId', async () => {
    const app = await buildApp(tmpDir)
    await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    const response = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    expect(response.status).toBe(409)
  })

  it('returns 400 on invalid body', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalRoomId: 'not-a-number' }),
      }),
    )
    expect(response.status).toBe(400)
  })
})

describe('PUT /api/rooms/:id', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rooms-test-'))
  })
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('updates a room', async () => {
    const app = await buildApp(tmpDir)

    const createRes = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    const { room } = (await createRes.json()) as { room: { id: string } }

    const updateRes = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translationStyle: 'TECHNICAL' }),
      }),
    )
    expect(updateRes.status).toBe(200)
    const body = (await updateRes.json()) as { room: Record<string, unknown> }
    expect(body.room.translationStyle).toBe('TECHNICAL')
  })

  it('returns 404 for unknown id', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/api/rooms/non-existent-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translationStyle: 'TECHNICAL' }),
      }),
    )
    expect(response.status).toBe(404)
  })
})

describe('DELETE /api/rooms/:id', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rooms-test-'))
  })
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('deletes a room', async () => {
    const app = await buildApp(tmpDir)
    const createRes = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    const { room } = (await createRes.json()) as { room: { id: string } }

    const deleteRes = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}`, { method: 'DELETE' }),
    )
    expect(deleteRes.status).toBe(204)

    const listRes = await app.handle(new Request('http://localhost/api/rooms'))
    const body = (await listRes.json()) as { rooms: unknown[] }
    expect(body.rooms).toHaveLength(0)
  })
})

describe('POST /api/rooms/:id/enable and /disable', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'rooms-test-'))
  })
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('enables a room', async () => {
    const app = await buildApp(tmpDir)
    const createRes = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    const { room } = (await createRes.json()) as { room: { id: string } }

    const res = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}/enable`, { method: 'POST' }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { room: { enabled: boolean } }
    expect(body.room.enabled).toBe(true)
  })

  it('disables a room', async () => {
    const app = await buildApp(tmpDir)
    const createRes = await app.handle(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      }),
    )
    const { room } = (await createRes.json()) as { room: { id: string } }

    await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}/enable`, { method: 'POST' }),
    )
    const res = await app.handle(
      new Request(`http://localhost/api/rooms/${room.id}/disable`, { method: 'POST' }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { room: { enabled: boolean } }
    expect(body.room.enabled).toBe(false)
  })
})
```

- [ ] **Step 2: Implement `packages/translator/src/routes/rooms.ts`**

```typescript
import { Elysia, t } from 'elysia'
import { createRoom as createChatworkRoom } from '@chatwork-bot/chatwork'
import type { RoomConfigStore } from '~/services/room-config-store'
import { RoomConfigStoreError } from '~/services/room-config-store'
import { CreateRoomRequestSchema, UpdateRoomRequestSchema } from '~/types/room-config'

interface RoomsRoutesOptions {
  store: RoomConfigStore
  chatworkApiToken: string
}

export function createRoomsRoutes({ store, chatworkApiToken }: RoomsRoutesOptions) {
  return new Elysia({ name: 'translator:rooms' })
    .get('/api/rooms', () => {
      return { rooms: store.list() }
    })
    .get('/api/rooms/:id', async ({ params, set }) => {
      const room = await store.getById(params.id)
      if (room === null) {
        set.status = 404
        return { error: 'Room not found' }
      }
      return { room }
    })
    .post(
      '/api/rooms',
      async ({ body, set, request }) => {
        const parsed = CreateRoomRequestSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 400
          return { error: 'Invalid request body', details: parsed.error.issues }
        }

        const data = parsed.data

        // Check uniqueness before calling Chatwork API
        const existing = store.getByOriginalRoomId(data.originalRoomId)
        if (existing !== null) {
          set.status = 409
          return { error: `originalRoomId ${data.originalRoomId.toString()} already exists` }
        }

        // Check for duplicate destinationRoomName (warn only)
        const allRooms = store.list()
        const duplicateName = allRooms.some(
          (r) => r.destinationRoomName === data.destinationRoomName,
        )
        if (duplicateName) {
          console.warn(
            JSON.stringify({
              level: 'warn',
              service: 'translator',
              event: 'duplicate_destination_room_name',
              destinationRoomName: data.destinationRoomName,
            }),
          )
        }

        // Create destination room on Chatwork
        let destinationRoomId: number
        try {
          const created = await createChatworkRoom(
            { name: data.destinationRoomName, members_admin_ids: '0' },
            chatworkApiToken,
          )
          destinationRoomId = created.room_id
        } catch (err) {
          set.status = 502
          return {
            error: 'Failed to create destination room on Chatwork',
            details: err instanceof Error ? err.message : String(err),
          }
        }

        const room = await store.create({ ...data, destinationRoomId })

        const origin = new URL(request.url).origin
        const webhookUrl = `${origin}/webhook`

        set.status = 201
        return { room, webhookUrl }
      },
      { body: t.Unknown() },
    )
    .put(
      '/api/rooms/:id',
      async ({ params, body, set }) => {
        const parsed = UpdateRoomRequestSchema.safeParse(body)
        if (!parsed.success) {
          set.status = 400
          return { error: 'Invalid request body', details: parsed.error.issues }
        }

        try {
          const room = await store.update(params.id, parsed.data)
          return { room }
        } catch (err) {
          if (err instanceof RoomConfigStoreError && err.code === 'NOT_FOUND') {
            set.status = 404
            return { error: 'Room not found' }
          }
          throw err
        }
      },
      { body: t.Unknown() },
    )
    .delete('/api/rooms/:id', async ({ params, set }) => {
      try {
        await store.delete(params.id)
        set.status = 204
        return null
      } catch (err) {
        if (err instanceof RoomConfigStoreError && err.code === 'NOT_FOUND') {
          set.status = 404
          return { error: 'Room not found' }
        }
        throw err
      }
    })
    .post('/api/rooms/:id/enable', async ({ params, set }) => {
      try {
        const room = await store.setEnabled(params.id, true)
        return { room }
      } catch (err) {
        if (err instanceof RoomConfigStoreError && err.code === 'NOT_FOUND') {
          set.status = 404
          return { error: 'Room not found' }
        }
        throw err
      }
    })
    .post('/api/rooms/:id/disable', async ({ params, set }) => {
      try {
        const room = await store.setEnabled(params.id, false)
        return { room }
      } catch (err) {
        if (err instanceof RoomConfigStoreError && err.code === 'NOT_FOUND') {
          set.status = 404
          return { error: 'Room not found' }
        }
        throw err
      }
    })
}
```

- [ ] **Step 3: Run tests**

```bash
bun test packages/translator/src/routes/rooms.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/routes/rooms.ts packages/translator/src/routes/rooms.test.ts
git commit -m "feat(translator): add /api/rooms CRUD endpoints"
```

---

## Task 7: Create providers endpoint

**Files:**

- Create: `packages/translator/src/routes/providers.ts`
- Create: `packages/translator/src/routes/providers.test.ts`

- [ ] **Step 1: Create `packages/translator/src/routes/providers.test.ts`**

```typescript
import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { Elysia } from 'elysia'
import { registerAllProviders } from '~/bootstrap/register-providers'
import { resetProviderRegistryForTest } from '@chatwork-bot/core'
import { providersRoute } from './providers'

describe('GET /api/providers', () => {
  beforeAll(() => {
    registerAllProviders()
  })

  afterAll(() => {
    resetProviderRegistryForTest()
  })

  it('returns list of providers with models', async () => {
    const app = new Elysia().use(providersRoute)
    const response = await app.handle(new Request('http://localhost/api/providers'))
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      providers: Array<{ id: string; supportedModels: string[]; defaultModel: string }>
    }
    expect(body.providers.length).toBeGreaterThan(0)
    expect(body.providers[0]).toHaveProperty('id')
    expect(body.providers[0]).toHaveProperty('supportedModels')
    expect(body.providers[0]).toHaveProperty('defaultModel')
  })
})
```

- [ ] **Step 2: Create `packages/translator/src/routes/providers.ts`**

```typescript
import { Elysia } from 'elysia'
import { listProviderPlugins } from '@chatwork-bot/core'

export const providersRoute = new Elysia({ name: 'translator:providers' }).get(
  '/api/providers',
  () => {
    const providers = listProviderPlugins().map((p) => ({
      id: p.manifest.id,
      supportedModels: p.manifest.supportedModels,
      defaultModel: p.manifest.defaultModel,
      timeoutMs: p.manifest.timeoutMs,
    }))
    return { providers }
  },
)
```

- [ ] **Step 3: Run tests**

```bash
bun test packages/translator/src/routes/providers.test.ts
```

Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/routes/providers.ts packages/translator/src/routes/providers.test.ts
git commit -m "feat(translator): add GET /api/providers endpoint"
```

---

## Task 8: Add internal room-secret endpoint

**Files:**

- Create: `packages/translator/src/routes/internal-room-secret.ts`
- Create: `packages/translator/src/routes/internal-room-secret.test.ts`

- [ ] **Step 1: Write failing tests first — create `packages/translator/src/routes/internal-room-secret.test.ts`**

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Elysia } from 'elysia'
import { createInternalRoomSecretRoute } from './internal-room-secret'
import { RoomConfigStore } from '~/services/room-config-store'

const KEY_HEX = 'a'.repeat(64)
const INTERNAL_SECRET = 'my-internal-secret'

async function buildApp(dataDir: string) {
  const store = new RoomConfigStore({ dataDir, encryptionKeyHex: KEY_HEX })
  await store.init()

  // Seed one room
  await store.create({
    originalRoomId: 5001,
    destinationRoomId: 6001,
    destinationRoomName: 'Test Room',
    aiProvider: 'openai',
    aiModel: null,
    translationStyle: 'PROFESSIONAL_BUSINESS',
    aiApiToken: 'token-abc',
    webhookSecret: 'secret-xyz',
  })

  const route = createInternalRoomSecretRoute({ store, internalApiSecret: INTERNAL_SECRET })
  return new Elysia().use(route)
}

describe('GET /internal/room-secret', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'room-secret-test-'))
  })
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns decrypted secret for known room_id with correct internal secret', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret?room_id=5001', {
        headers: { 'x-internal-secret': INTERNAL_SECRET },
      }),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { webhookSecret: string }
    expect(body.webhookSecret).toBe('secret-xyz')
  })

  it('returns 401 when X-Internal-Secret is missing', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret?room_id=5001'),
    )
    expect(response.status).toBe(401)
  })

  it('returns 401 when X-Internal-Secret is wrong', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret?room_id=5001', {
        headers: { 'x-internal-secret': 'wrong-secret' },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('returns 404 for unknown room_id', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret?room_id=9999', {
        headers: { 'x-internal-secret': INTERNAL_SECRET },
      }),
    )
    expect(response.status).toBe(404)
  })

  it('returns 400 when room_id query param is missing', async () => {
    const app = await buildApp(tmpDir)
    const response = await app.handle(
      new Request('http://localhost/internal/room-secret', {
        headers: { 'x-internal-secret': INTERNAL_SECRET },
      }),
    )
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Implement `packages/translator/src/routes/internal-room-secret.ts`**

```typescript
import { Elysia } from 'elysia'
import type { RoomConfigStore } from '~/services/room-config-store'

interface InternalRoomSecretRouteOptions {
  store: RoomConfigStore
  internalApiSecret: string
}

export function createInternalRoomSecretRoute({
  store,
  internalApiSecret,
}: InternalRoomSecretRouteOptions) {
  return new Elysia({ name: 'translator:internal-room-secret' }).get(
    '/internal/room-secret',
    async ({ headers, query, set }) => {
      const providedSecret = headers['x-internal-secret']
      if (!providedSecret || providedSecret !== internalApiSecret) {
        set.status = 401
        return { error: 'Unauthorized' }
      }

      const roomIdRaw = query.room_id
      if (!roomIdRaw) {
        set.status = 400
        return { error: 'Missing room_id query parameter' }
      }

      const roomId = parseInt(roomIdRaw, 10)
      if (isNaN(roomId)) {
        set.status = 400
        return { error: 'room_id must be a number' }
      }

      const room = store.getByOriginalRoomId(roomId)
      if (room === null) {
        set.status = 404
        return { error: `No room configured for room_id ${roomId.toString()}` }
      }

      const webhookSecret = await store.decryptWebhookSecret(room.encryptedWebhookSecret)
      return { webhookSecret }
    },
  )
}
```

- [ ] **Step 3: Run tests**

```bash
bun test packages/translator/src/routes/internal-room-secret.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/translator/src/routes/internal-room-secret.ts packages/translator/src/routes/internal-room-secret.test.ts
git commit -m "feat(translator): add GET /internal/room-secret endpoint with X-Internal-Secret auth"
```

---

## Task 9: Refactor webhook handler to use per-room config

This is the most critical step. The handler must resolve room config on every request instead of using global env vars.

**Files:**

- Modify: `packages/translator/src/webhook/handler.ts`
- Create/Modify: `packages/translator/src/webhook/handler.test.ts`

- [ ] **Step 1: Write failing tests first — create `packages/translator/src/webhook/handler.test.ts`**

```typescript
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RoomConfigStore } from '~/services/room-config-store'
import { registerAllProviders, resetProviderRegistryForTest } from '@chatwork-bot/core'
import type { TranslationIngressCommand } from '@chatwork-bot/core'

// ─── Minimal command factory ───────────────────────────────────────────────────

function makeCommand(
  overrides: Partial<TranslationIngressCommand> = {},
): TranslationIngressCommand {
  return {
    sourceMessageId: 'msg-001',
    sourceRoomId: 5001,
    sourceEventType: 'mention_to_me',
    rawBody: 'Hello',
    translatableText: 'Hello',
    translationInputs: [],
    audit: { rawSourceSnapshot: {} },
    receivedAt: new Date().toISOString(),
    ...overrides,
  } as TranslationIngressCommand
}

const KEY_HEX = 'a'.repeat(64)

describe('handleTranslateRequest', () => {
  let tmpDir: string
  let store: RoomConfigStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'handler-test-'))
    store = new RoomConfigStore({ dataDir: tmpDir, encryptionKeyHex: KEY_HEX })
    await store.init()
    registerAllProviders()
  })

  afterEach(async () => {
    resetProviderRegistryForTest()
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns early (no-op) when sourceRoomId has no config', async () => {
    const { createHandleTranslateRequest } = await import('./handler')
    const handle = createHandleTranslateRequest({ store, chatworkApiToken: 'token' })

    // Should not throw — just silently skip
    await expect(handle(makeCommand({ sourceRoomId: 9999 }))).resolves.toBeUndefined()
  })

  it('returns early (no-op) when room is disabled', async () => {
    await store.create({
      originalRoomId: 5001,
      destinationRoomId: 6001,
      destinationRoomName: 'Output',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'sk-openai',
      webhookSecret: 'secret',
    })
    // Room is enabled: false by default

    const { createHandleTranslateRequest } = await import('./handler')
    const handle = createHandleTranslateRequest({ store, chatworkApiToken: 'token' })

    await expect(handle(makeCommand({ sourceRoomId: 5001 }))).resolves.toBeUndefined()
  })

  it('skips translation for empty translatableText', async () => {
    const room = await store.create({
      originalRoomId: 5001,
      destinationRoomId: 6001,
      destinationRoomName: 'Output',
      aiProvider: 'openai',
      aiModel: null,
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiApiToken: 'sk-openai',
      webhookSecret: 'secret',
    })
    await store.setEnabled(room.id, true)

    const { createHandleTranslateRequest } = await import('./handler')
    const handle = createHandleTranslateRequest({ store, chatworkApiToken: 'token' })

    await expect(
      handle(makeCommand({ sourceRoomId: 5001, translatableText: '   ' })),
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Refactor `packages/translator/src/webhook/handler.ts`**

The handler must be changed from a function that reads `env` directly to a factory function `createHandleTranslateRequest` that receives `store` and `chatworkApiToken` as dependencies. The per-room lookup logic is:

1. Look up `command.sourceRoomId` via `store.getByOriginalRoomId(command.sourceRoomId)`
2. If `null` → log and return (no-op, 200)
3. If `room.enabled === false` → log and return (no-op, 200)
4. If enabled → decrypt `room.encryptedAiApiToken`, get provider plugin by `room.aiProvider`, build executor, run pipeline with `room.translationStyle`, deliver to `room.destinationRoomId`

The key changes to `packages/translator/src/webhook/handler.ts`:

```typescript
import { getProviderPlugin, TranslationError } from '@chatwork-bot/core'
import type { TranslationIngressCommand, ProviderCreateContext } from '@chatwork-bot/core'
import type { RoomConfigStore } from '~/services/room-config-store'
import { TranslationPipeline } from '~/pipeline/pipeline'
import { writeTranslationOutput } from '~/utils/output-writer'
import { sendTranslatedMessage } from '~/services/chatwork-sender'
import { resolveOutputOrigin } from '~/services/output-origin'
import {
  buildDatasetRunnerAckPayload,
  notifyDatasetRunner,
} from '~/services/dataset-runner-callback'
import type { OutputDelivery } from '~/types/output'
import {
  getTranslatorObservabilityConfig,
  getTranslatorStatusStore,
  logTranslatorEvent,
} from '~/services/translator-observability-runtime'
import {
  hasExplicitPipelineTimeoutOverride,
  resolvePipelineTimeout,
} from '~/services/pipeline-timeout'
import { createPhaseObserver } from '~/services/phase-observer'
import { env } from '~/env'

interface HandleTranslateRequestDeps {
  store: RoomConfigStore
  chatworkApiToken: string
}

export function createHandleTranslateRequest(deps: HandleTranslateRequestDeps) {
  return async function handleTranslateRequest(command: TranslationIngressCommand): Promise<void> {
    // ─── Per-room config resolution ────────────────────────────────────────────
    const roomConfig = deps.store.getByOriginalRoomId(command.sourceRoomId)

    if (roomConfig === null) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'translation_skipped_no_room_config',
          timestamp: new Date().toISOString(),
          sourceRoomId: command.sourceRoomId,
          sourceMessageId: command.sourceMessageId,
        }),
      )
      return
    }

    if (!roomConfig.enabled) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'translation_skipped_room_disabled',
          timestamp: new Date().toISOString(),
          sourceRoomId: command.sourceRoomId,
          roomConfigId: roomConfig.id,
          sourceMessageId: command.sourceMessageId,
        }),
      )
      return
    }

    // ─── Empty text guard ─────────────────────────────────────────────────────
    if (command.translatableText.trim() === '' && !hasMeaningfulLiteralStructure(command)) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'translation_skipped_empty',
          timestamp: new Date().toISOString(),
          sourceMessageId: command.sourceMessageId,
          sourceEventType: command.sourceEventType,
          rawBodyLength: command.rawBody.length,
          rawBodyPreview: command.rawBody.slice(0, 300),
        }),
      )
      return
    }

    const cleanText = command.translatableText

    // ─── Decrypt per-room AI token ─────────────────────────────────────────────
    const aiApiToken = await deps.store.decryptApiToken(roomConfig.encryptedAiApiToken)

    const plugin = getProviderPlugin(roomConfig.aiProvider)
    const modelId = roomConfig.aiModel ?? plugin.manifest.defaultModel
    const translationStyle = roomConfig.translationStyle
    const ctx: ProviderCreateContext = { modelId, apiKey: aiApiToken }
    const baseUrl = process.env['CURSOR_API_URL']
    if (baseUrl) {
      ctx.baseUrl = baseUrl
    }
    const executor = plugin.create(ctx)

    // ... rest of handler unchanged except:
    // - Replace env.CHATWORK_API_TOKEN with deps.chatworkApiToken
    // - Replace env.CHATWORK_DESTINATION_ROOM_ID with roomConfig.destinationRoomId
    // - Replace env.AI_PROVIDER with roomConfig.aiProvider
    // - Replace env.AI_MODEL with modelId
    // - Replace env.AI_TRANSLATION_STYLE with translationStyle
  }
}
```

**Important:** Keep the entire rest of the handler body (pipeline run, delivery, observability, ack callback) identical to the current implementation, just substituting the per-room values. The `ProviderCreateContext` must pass `apiKey` so providers use the per-room token rather than reading it from env.

- [ ] **Step 3: Run handler tests**

```bash
bun test packages/translator/src/webhook/handler.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 4: Update router to use factory**

In `packages/translator/src/webhook/router.ts`, update to call `createHandleTranslateRequest` instead of `handleTranslateRequest`. The store and chatworkApiToken must be threaded through from `app.ts` or via a module-level singleton initialized at startup.

The cleanest pattern is to export a `initTranslateHandler(deps)` from `handler.ts` that sets a module-level singleton, then call `initTranslateHandler` from `packages/translator/src/index.ts` after the store is ready.

- [ ] **Step 5: Commit**

```bash
git add packages/translator/src/webhook/handler.ts packages/translator/src/webhook/handler.test.ts packages/translator/src/webhook/router.ts
git commit -m "refactor(translator): resolve room config per-request instead of reading global env"
```

---

## Task 10: Update translator app.ts and startup

**Files:**

- Modify: `packages/translator/src/app.ts`
- Modify: `packages/translator/src/index.ts`
- Modify: `packages/translator/src/bootstrap/startup-guards.ts`
- Modify: `packages/translator/src/bootstrap/startup-guards.test.ts`
- Modify: `packages/translator/src/bootstrap/startup-banner.ts`
- Modify: `packages/translator/src/bootstrap/startup-banner.test.ts`

- [ ] **Step 1: Update startup-guards.ts**

Remove the provider env key check (no longer applicable — keys are per-room). Replace with a guard that validates `ROOM_CONFIG_ENCRYPTION_KEY` length and `INTERNAL_API_SECRET` presence (these are already validated by Zod schema at env parse time, so `startup-guards.ts` can be simplified):

```typescript
// startup-guards.ts only validates things that Zod cannot (e.g. connectivity checks)
import { listProviderPlugins } from '@chatwork-bot/core'

export async function runStartupGuards(): Promise<void> {
  // Verify at least some providers are registered
  const plugins = listProviderPlugins()
  if (plugins.length === 0) {
    throw new Error('[startup] No providers registered. Did registerAllProviders() run?')
  }

  // cursor-proxy reachability check (optional, only when cursor provider registered)
  const hasCursor = plugins.some((p) => p.manifest.id === 'cursor')
  if (hasCursor) {
    const proxyUrl = process.env['CURSOR_API_URL'] ?? 'http://localhost:8765/v1'
    const ok = await fetch(`${proxyUrl}/models`)
      .then((r) => r.ok)
      .catch(() => false)

    if (!ok) {
      console.warn(
        `[startup] Warning: Cursor proxy not reachable at ${proxyUrl}\n` +
          '  Per-room configs using cursor provider will fail at runtime.',
      )
    }
  }
}
```

- [ ] **Step 2: Update startup-banner.ts**

Remove `provider`, `model`, and `translationStyle` fields from `BannerConfig`. The banner should now note that AI provider/model/style are configured per-room:

```typescript
interface BannerConfig {
  port: number
  nodeEnv: string
  effectiveTimeoutMs: number
  timeoutSource: PipelineTimeoutSource
  roomCount: number
}
```

Add a summary line: `[translator] * AI provider/model/style configured per-room (${roomCount} rooms loaded)`

- [ ] **Step 3: Update app.ts to register new routes**

```typescript
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import logixlysia from 'logixlysia'
import { healthRoutes } from './routes/health'
import { providerHealthRoute } from './routes/provider-health'
import { createStatusRoute } from './routes/status'
import { providersRoute } from './routes/providers'
import { createRoomsRoutes } from './routes/rooms'
import { createInternalRoomSecretRoute } from './routes/internal-room-secret'
import { getTranslatorStatusSnapshot } from './services/translator-observability-runtime'
import { translateRoutes } from './webhook/router'
import { env } from './env'
import type { RoomConfigStore } from './services/room-config-store'

interface AppOptions {
  store: RoomConfigStore
}

export function createApp({ store }: AppOptions) {
  const app = new Elysia({ name: 'translator' })

  if (env.NODE_ENV !== 'test') {
    app.use(logixlysia({ config: { showStartupMessage: false, ip: false } }))
  }

  app.use(cors())

  if (env.NODE_ENV === 'development') {
    app.use(
      swagger({
        path: '/docs',
        documentation: { info: { title: 'Translator API', version: '1.0.0' } },
      }),
    )
  }

  return app
    .use(healthRoutes)
    .use(providerHealthRoute)
    .use(createStatusRoute(() => getTranslatorStatusSnapshot()))
    .use(providersRoute)
    .use(createRoomsRoutes({ store, chatworkApiToken: env.CHATWORK_API_TOKEN }))
    .use(createInternalRoomSecretRoute({ store, internalApiSecret: env.INTERNAL_API_SECRET }))
    .use(translateRoutes)
}
```

- [ ] **Step 4: Update index.ts**

```typescript
import { env } from './env'
import { registerAllProviders } from '~/bootstrap/register-providers'
import { runStartupGuards } from '~/bootstrap/startup-guards'
import { logStartupBanner } from '~/bootstrap/startup-banner'
import {
  hasExplicitPipelineTimeoutOverride,
  resolvePipelineTimeout,
  DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS,
} from '~/services/pipeline-timeout'
import { RoomConfigStore } from '~/services/room-config-store'
import { initTranslateHandler } from '~/webhook/handler'
import { createServer } from './server'

registerAllProviders()
await runStartupGuards()

const store = new RoomConfigStore({
  dataDir: env.ROOM_CONFIG_DATA_DIR,
  encryptionKeyHex: env.ROOM_CONFIG_ENCRYPTION_KEY,
})
await store.init()

// Wire the per-room handler
initTranslateHandler({ store, chatworkApiToken: env.CHATWORK_API_TOKEN })

const { effectiveTimeoutMs, timeoutSource } = resolvePipelineTimeout({
  envTimeoutMs: env.TRANSLATOR_PIPELINE_TIMEOUT_MS,
  hasEnvOverride: hasExplicitPipelineTimeoutOverride(),
  providerTimeoutMs: DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS,
})

const server = createServer({ store })

server.listen(env.PORT)

console.log(`[translator] AI Translation Service started on port ${env.PORT.toString()}`)
logStartupBanner({
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  effectiveTimeoutMs,
  timeoutSource,
  roomCount: store.list().length,
})
console.log(`[translator] Health check: http://localhost:${env.PORT.toString()}/health`)
console.log(`[translator] Room config API: http://localhost:${env.PORT.toString()}/api/rooms`)
console.log(`[translator] Providers API: http://localhost:${env.PORT.toString()}/api/providers`)
if (env.NODE_ENV === 'development') {
  console.log(`[translator] Swagger UI: http://localhost:${env.PORT.toString()}/docs`)
}
```

- [ ] **Step 5: Install @elysiajs/cors in translator**

In `packages/translator/package.json`, add `"@elysiajs/cors": "^1.0.0"` to dependencies, then run:

```bash
bun install
```

- [ ] **Step 6: Run full test suite**

```bash
bun test packages/translator
```

Expected: All tests pass (existing tests updated where needed for the new app factory signature).

- [ ] **Step 7: Commit**

```bash
git add packages/translator/src/app.ts packages/translator/src/index.ts packages/translator/src/bootstrap/startup-guards.ts packages/translator/src/bootstrap/startup-guards.test.ts packages/translator/src/bootstrap/startup-banner.ts packages/translator/src/bootstrap/startup-banner.test.ts packages/translator/package.json bun.lock
git commit -m "refactor(translator): wire RoomConfigStore into app, update startup guards and banner"
```

---

## Task 11: Update webhook-logger for per-room secrets

**Files:**

- Modify: `packages/webhook-logger/src/env.ts`
- Modify: `packages/webhook-logger/src/routes/webhook.ts`
- Modify: `packages/webhook-logger/src/routes/webhook.test.ts`

- [ ] **Step 1: Update `packages/webhook-logger/src/env.ts`**

```typescript
import { z } from 'zod'
import { strictBooleanFromEnv } from '@chatwork-bot/core'

const envSchema = z.object({
  LOGGER_PORT: z.coerce.number().int().positive().default(3001),
  TRANSLATOR_URL: z.string().pipe(z.url()).default('http://localhost:3000'),
  TRANSLATOR_INTERNAL_URL: z.string().pipe(z.url()).default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
  INTERNAL_API_SECRET: z.string().min(1, 'INTERNAL_API_SECRET is required'),
  CHATWORK_SKIP_SIGNATURE_VERIFY: strictBooleanFromEnv(false),
})

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('[env] Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}

export const env = validateEnv()

export type Env = z.infer<typeof envSchema>
```

- [ ] **Step 2: Update `packages/webhook-logger/src/routes/webhook.ts`**

Replace the single `env.CHATWORK_WEBHOOK_SECRET` with a per-request fetch from `/internal/room-secret`. Extract `room_id` from the incoming webhook payload **before** verifying the signature (from the JSON body `webhook_setting.room_id` or equivalent field in the Chatwork payload) — or parse it from the raw body with a minimal JSON parse.

The updated flow:

1. Parse `room_id` from the raw body (JSON parse, no Zod yet — just extract the number)
2. Fetch `GET {TRANSLATOR_INTERNAL_URL}/internal/room-secret?room_id={room_id}` with `X-Internal-Secret: {INTERNAL_API_SECRET}`
3. If 404 → log + return 200 (no config for this room, silently ignore)
4. If other error → log + return 503
5. Use returned `webhookSecret` to call `verifyWebhookSignature`
6. Continue with existing normalization + forward flow

```typescript
import { Elysia } from 'elysia'
import {
  verifyWebhookSignature,
  normalizeWebhookPayload,
  mapWebhookToTranslationCommand,
  ChatworkWebhookSignatureError,
  ChatworkWebhookPayloadError,
} from '@chatwork-bot/chatwork'
import { env } from '~/env'

export const webhookRoutes = new Elysia({ name: 'webhook-logger:webhook' })
  .derive(async ({ request }) => ({
    rawBody: await request.clone().text(),
  }))
  .post('/webhook', ({ rawBody, headers }) => handleWebhook(rawBody, headers))
  .post('/', ({ rawBody, headers }) => handleWebhook(rawBody, headers))

async function fetchRoomSecret(roomId: number): Promise<string | null> {
  const url = `${env.TRANSLATOR_INTERNAL_URL}/internal/room-secret?room_id=${roomId.toString()}`
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'x-internal-secret': env.INTERNAL_API_SECRET },
    })
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'room_secret_fetch_failed',
        timestamp: new Date().toISOString(),
        roomId,
        errorMessage: err instanceof Error ? err.message : String(err),
      }),
    )
    return null
  }

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'room_secret_fetch_error',
        timestamp: new Date().toISOString(),
        roomId,
        status: response.status,
      }),
    )
    return null
  }

  const body = (await response.json()) as { webhookSecret: string }
  return body.webhookSecret
}

function extractRoomId(rawBody: string): number | null {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>
    // Chatwork webhook payload: webhook_setting.room_id
    const setting = parsed['webhook_setting'] as Record<string, unknown> | undefined
    const roomId = setting?.['room_id']
    if (typeof roomId === 'number') return roomId
  } catch {
    // ignore
  }
  return null
}

async function handleWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
): Promise<Response> {
  const signature = headers['x-chatworkwebhooksignature']
  if (!signature) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'webhook_signature_missing',
        timestamp: new Date().toISOString(),
        errorCode: 'WEBHOOK_SIGNATURE_MISSING',
        errorMessage: 'Missing X-ChatWorkWebhookSignature header',
      }),
    )
    return new Response('Missing signature header', { status: 422 })
  }

  // ─── Per-room secret resolution ─────────────────────────────────────────────
  const roomId = extractRoomId(rawBody)
  if (roomId === null) {
    return new Response('Cannot extract room_id from payload', { status: 422 })
  }

  const webhookSecret = await fetchRoomSecret(roomId)
  if (webhookSecret === null) {
    // No config for this room — silently acknowledge
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'webhook-logger',
        event: 'webhook_skipped_no_room_config',
        timestamp: new Date().toISOString(),
        roomId,
      }),
    )
    return new Response('OK', { status: 200 })
  }

  // ─── Signature verification ─────────────────────────────────────────────────
  const skipVerify = env.CHATWORK_SKIP_SIGNATURE_VERIFY && env.NODE_ENV !== 'production'
  if (skipVerify) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        service: 'webhook-logger',
        event: 'webhook_signature_verification_bypassed',
        timestamp: new Date().toISOString(),
        message: 'Signature verification bypassed (CHATWORK_SKIP_SIGNATURE_VERIFY=true)',
      }),
    )
  }

  try {
    verifyWebhookSignature(rawBody, signature, webhookSecret, {
      skip: skipVerify,
      env: env.NODE_ENV,
    })
  } catch (err: unknown) {
    if (err instanceof ChatworkWebhookSignatureError) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'webhook-logger',
          event: 'webhook_signature_invalid',
          timestamp: new Date().toISOString(),
          errorCode: 'WEBHOOK_SIGNATURE_INVALID',
          errorMessage: err.message,
        }),
      )
      return new Response('Invalid webhook signature', { status: 422 })
    }
    throw err
  }

  // ─── Payload normalization ─────────────────────────────────────────────────
  let payload: ReturnType<typeof normalizeWebhookPayload>
  try {
    payload = normalizeWebhookPayload(rawBody)
  } catch (err: unknown) {
    if (err instanceof ChatworkWebhookPayloadError) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'webhook-logger',
          event: 'webhook_payload_invalid',
          timestamp: new Date().toISOString(),
          errorCode: 'WEBHOOK_PAYLOAD_INVALID',
          errorMessage: err.message,
        }),
      )
      return new Response('Invalid webhook payload', { status: 422 })
    }
    throw err
  }

  const command = mapWebhookToTranslationCommand(payload, new Date().toISOString())

  const sourceMessageId = command.sourceMessageId

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'webhook-logger',
      event: 'webhook_received',
      timestamp: new Date().toISOString(),
      sourceMessageId,
      roomId,
    }),
  )

  // ─── Forward to translator ─────────────────────────────────────────────────
  let response: Response
  try {
    response = await fetch(`${env.TRANSLATOR_URL}/internal/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    })
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'translation_forward_failed',
        timestamp: new Date().toISOString(),
        sourceMessageId,
        roomId,
        errorCode: err instanceof Error ? err.name : 'UnknownError',
        errorMessage: err instanceof Error ? err.message : String(err),
      }),
    )
    return new Response('Translator unavailable', { status: 503 })
  }

  if (!response.ok) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'webhook-logger',
        event: 'translation_forward_failed',
        timestamp: new Date().toISOString(),
        sourceMessageId,
        roomId,
        errorCode: 'TRANSLATOR_HTTP',
        errorMessage: `Translator responded with ${String(response.status)}`,
        translatorStatus: response.status,
      }),
    )
    return new Response(`Translator error: ${String(response.status)}`, { status: 502 })
  }

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'webhook-logger',
      event: 'translation_forward_completed',
      timestamp: new Date().toISOString(),
      sourceMessageId,
      roomId,
      translatorStatus: response.status,
    }),
  )

  return new Response('OK', { status: 200 })
}
```

- [ ] **Step 3: Update `packages/webhook-logger/src/routes/webhook.test.ts`**

Read the current test file and update all tests that mock `env.CHATWORK_WEBHOOK_SECRET` to instead mock the `fetch` call to `/internal/room-secret`. Tests must cover:

- No room config for room_id (200 OK, skip)
- Valid secret fetched, correct signature → forward succeeds (200)
- Valid secret fetched, wrong signature → 422
- Secret fetch returns error → 503
- Missing signature header → 422

- [ ] **Step 4: Run webhook-logger tests**

```bash
bun test packages/webhook-logger
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/webhook-logger/src/env.ts packages/webhook-logger/src/routes/webhook.ts packages/webhook-logger/src/routes/webhook.test.ts
git commit -m "refactor(webhook-logger): fetch per-room webhook secret from translator internal API"
```

---

## Task 12: Final integration check and pre-PR validation

- [ ] **Step 1: Run full test suite**

```bash
bun test
```

Expected: All tests pass. No regressions.

- [ ] **Step 2: Type check**

```bash
bun run typecheck
```

Expected: Zero errors.

- [ ] **Step 3: Lint**

```bash
bun run lint
```

Expected: Zero errors.

- [ ] **Step 4: Verify standards**

```bash
bun run verify:standards
```

Expected: `[verify-standards] ✓ All packages meet standards`

- [ ] **Step 5: Manual smoke test (optional, if running locally)**

Start services:

```bash
bun run dev
```

Create a room via the API:

```bash
curl -X POST http://localhost:3000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "originalRoomId": 12345,
    "destinationRoomName": "Translation Output",
    "aiProvider": "openai",
    "aiModel": null,
    "translationStyle": "PROFESSIONAL_BUSINESS",
    "aiApiToken": "sk-your-key",
    "webhookSecret": "your-webhook-secret"
  }'
```

Enable the room:

```bash
curl -X POST http://localhost:3000/api/rooms/{id}/enable
```

Send a test webhook to `http://localhost:3001/webhook` and verify translation flows to the destination room.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore(repo): complete Phase 4 backend refactor — per-room config system"
```

---

## Ship & Review

**Success criteria:**

1. `bun test` — zero failures, >95% coverage on all new files
2. `bun run typecheck` — zero TypeScript errors
3. `bun run lint` — zero ESLint errors
4. `GET /api/rooms` returns rooms with secrets redacted
5. `POST /api/rooms` creates a room + creates destination room on Chatwork
6. Webhook handler resolves room config per `sourceRoomId` (not global env)
7. Disabled rooms → 200 skip (no translation)
8. Unknown source room → 200 skip (no translation)
9. `GET /internal/room-secret` returns decrypted secret with correct `X-Internal-Secret`
10. webhook-logger fetches per-room secret from translator before verifying HMAC

**Await user approval before proceeding to Phase 5 (Dashboard UI integration).**
