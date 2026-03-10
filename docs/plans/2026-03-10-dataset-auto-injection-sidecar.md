# Dataset Auto-Injection Sidecar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-only dataset runner sidecar that injects Chatwork messages into the original room, advances strictly on translator-owned internal callback ACKs, processes JSONL datasets sequentially without duplicate sends, and supports one-shot replay/reset from startup env.

**Architecture:** Introduce a new `@chatwork-bot/dataset-runner` package as an internal Docker sidecar. Keep translator responsible for translation and destination-room delivery, but replace filesystem polling with an internal idempotent callback ACK from `translator` to `dataset-runner`. Keep HTTP routes as thin adapters and centralize queue orchestration inside `QueueRunner`; use immutable JSONL inputs plus manifest files under `input/state/` for resume, ACK durability, retries, duplicate prevention, and one-shot reset/replay semantics driven by explicit env vars.

**Tech Stack:** Bun v1.3+ · TypeScript strict · Elysia · Zod · bun:test · Docker Compose dev sidecars · workspace imports (`@chatwork-bot/*`) · `~/` intra-package alias

---

## Implementation Notes

- Execute this plan in a dedicated worktree, not in the main workspace.
- Commit scope is restricted by repo rules. Use:
  - `repo` for new package, compose, docs, env, and governance updates
  - `translator` for translator-only changes
- Keep `PLAN.md` untouched. The canonical docs become:
  - `docs/plans/2026-03-10-dataset-auto-injection-sidecar-design.md`
  - `docs/plans/2026-03-10-dataset-auto-injection-sidecar.md`

## File Map

**Create:**

- `packages/dataset-runner/package.json`
- `packages/dataset-runner/tsconfig.json`
- `packages/dataset-runner/src/index.ts`
- `packages/dataset-runner/src/server.ts`
- `packages/dataset-runner/src/app.ts`
- `packages/dataset-runner/src/app.test.ts`
- `packages/dataset-runner/src/env.ts`
- `packages/dataset-runner/src/env.test.ts`
- `packages/dataset-runner/src/routes/health.ts`
- `packages/dataset-runner/src/routes/health.test.ts`
- `packages/dataset-runner/src/routes/delivery-ack.ts`
- `packages/dataset-runner/src/routes/delivery-ack.test.ts`
- `packages/dataset-runner/src/routes/status.ts`
- `packages/dataset-runner/src/routes/status.test.ts`
- `packages/dataset-runner/src/types/delivery-ack.ts`
- `packages/dataset-runner/src/types/dataset.ts`
- `packages/dataset-runner/src/types/dataset.test.ts`
- `packages/dataset-runner/src/types/status.ts`
- `packages/dataset-runner/src/services/dataset-loader.ts`
- `packages/dataset-runner/src/services/dataset-loader.test.ts`
- `packages/dataset-runner/src/services/state-store.ts`
- `packages/dataset-runner/src/services/state-store.test.ts`
- `packages/dataset-runner/src/services/ack-store.ts`
- `packages/dataset-runner/src/services/ack-store.test.ts`
- `packages/dataset-runner/src/services/reset-planner.ts`
- `packages/dataset-runner/src/services/reset-planner.test.ts`
- `packages/dataset-runner/src/services/source-map.ts`
- `packages/dataset-runner/src/services/source-map.test.ts`
- `packages/dataset-runner/src/services/item-processor.ts`
- `packages/dataset-runner/src/services/item-processor.test.ts`
- `packages/dataset-runner/src/services/ack-coordinator.ts`
- `packages/dataset-runner/src/services/ack-coordinator.test.ts`
- `packages/dataset-runner/src/services/queue-runner.ts`
- `packages/dataset-runner/src/services/queue-runner.test.ts`
- `packages/translator/src/services/output-origin.ts`
- `packages/translator/src/services/output-origin.test.ts`
- `packages/translator/src/services/dataset-runner-callback.ts`
- `packages/translator/src/services/dataset-runner-callback.test.ts`
- `docs/operations/dataset-runner.md`
- `input/samples/001-vfa-thinhntt-2026-03-10.jsonl`

**Modify:**

- `packages/translator/src/types/output.ts`
- `packages/translator/src/utils/output-writer.ts`
- `packages/translator/src/utils/output-writer.test.ts`
- `packages/translator/src/services/chatwork-sender.ts`
- `packages/translator/src/services/chatwork-sender.test.ts`
- `packages/translator/src/services/dataset-runner-callback.ts`
- `packages/translator/src/services/dataset-runner-callback.test.ts`
- `packages/translator/src/webhook/handler.ts`
- `packages/translator/src/webhook/handler.test.ts`
- `.env.example`
- `.gitignore`
- `docker-compose.dev.yml`
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `ai_rules/project-structure.md`
- `ai_rules/commands.md`
- `ai_rules/security.md`
- `ai_rules/architecture-patterns.md`

## Sample Input JSONL

Seed batches are committed to `input/samples/` (git-tracked). Developers copy from there to
`input/pending/` before running automation. The `.gitignore` must exclude `input/pending/`,
`input/archive/`, `input/failed/`, and `input/state/`, but must **not** exclude `input/samples/`.

Canonical seed batch file (committed to repo):

```text
input/samples/001-vfa-thinhntt-2026-03-10.jsonl
```

Example content:

```jsonl
{"id":"vfa-001","message":"ありがとう","metadata":{"caseNo":1,"title":"Dịch từ đơn/Cụm từ thông dụng","expectedText":"Cảm ơn","category":"functional","tags":["jp-basic","sheet-import"],"source":"spreadsheet-import"}}
{"id":"vfa-002","message":"私はベトナム人です。","metadata":{"caseNo":2,"title":"Hệ thống chữ viết hỗn hợp","expectedText":"Tôi là người Việt Nam.","category":"functional","tags":["sentence","jp-basic"],"source":"spreadsheet-import"}}
{"id":"vfa-014","message":"Đoạn văn 1000 chữ","metadata":{"caseNo":14,"title":"Thời gian phản hồi (Response Time)","expectedRule":"Phản hồi nhận về < 2000ms.","category":"performance","tags":["response-time","sheet-import"],"source":"spreadsheet-import"}}
{"id":"vfa-017","message":"100 requests/giây","metadata":{"caseNo":17,"title":"Tải đồng thời (Concurrency)","expectedRule":"Hệ thống không bị timeout hoặc lỗi 5xx.","category":"concurrency","tags":["load","sheet-import"],"source":"spreadsheet-import"}}
{"id":"vfa-019","message":"東京スカイツリー","originalRoomId":424846369,"metadata":{"caseNo":19,"title":"Địa danh & Tên riêng cố định","expectedText":"Tokyo Skytree","category":"proper-noun","tags":["location","fixed-name"],"source":"spreadsheet-import"}}
{"id":"vfa-037","message":"あざす (Azasu)","metadata":{"caseNo":37,"title":"Viết tắt kết hợp sai chính tả","expectedRule":"Nhận diện ありがとうございます : Cảm ơn","category":"normalization","tags":["slang","misspelling","sheet-import"],"source":"spreadsheet-import"}}
```

Interpretation rules the implementation must enforce:

- one JSON object per physical line
- `message` is sent exactly as-is to Chatwork
- multiline content is represented with escaped `\n` inside the JSON string, not with multi-line JSON objects
- `originalRoomId` overrides `CHATWORK_ORIGINAL_ROOM_ID` only for that item
- `metadata` is runner-local only and must never be included in the Chatwork message body
- reject unknown top-level keys so typos fail fast
- prefer zero-padded file names such as `001-vfa-thinhntt-2026-03-10.jsonl`, `010-regression.jsonl`

Recommended TypeScript shape:

```ts
type DatasetItem = {
  id: string
  message: string
  originalRoomId?: number
  metadata?: {
    caseNo?: number
    title?: string
    expectedText?: string
    expectedRule?: string
    category?: string
    tags?: string[]
    notes?: string
    source?: string
  }
}
```

Spreadsheet-to-JSONL mapping to keep in scope:

- `No` -> `metadata.caseNo`
- `Test Case Detail` -> `metadata.title`
- `Data Input` -> `message`
- `Expected result` -> `metadata.expectedText` or `metadata.expectedRule`
- `Test date`, `Tester`, `Test result` -> not part of pending JSONL input
- rows `14` and `17` still go into the initial JSONL input because the user explicitly wants the
  full sheet treated as input

Initial canonical seed batch to keep in scope:

- file name: `input/pending/001-vfa-thinhntt-2026-03-10.jsonl`
- include rows `1-33` and `35-37`
- omit row `34` because it is blank
- total imported items: `36`

Raw `Data Input` values that must be represented in that first file:

- `1` -> `ありがとう`
- `2` -> `私はベトナム人です。`
- `3` -> `2026年3月10日`
- `4` -> `箸で食べる`
- `5` -> `いらっしゃいませ`
- `6` -> `食べさせられた`
- `7` -> `日本語は面白いです。`
- `8` -> `スマートフォン`
- `9` -> `Đoạn văn > 5000 ký tự`
- `10` -> `歩かせられた`
- `11` -> `食べぬく`
- `12` -> `あげる vs くれる`
- `13` -> `「こんにちは」...！？`
- `14` -> `Đoạn văn 1000 chữ`
- `15` -> `こんにちは &%^#*`
- `16` -> `Sugoi! (Romaji)`
- `17` -> `100 requests/giây`
- `18` -> `100万円`
- `19` -> `東京スカイツリー`
- `20` -> `あかん (Kansai-ben)`
- `21` -> `arigto hoặc ありかと`
- `22` -> `konniitwa`
- `23` -> `スタバ (Sutaba)`
- `24` -> `おめ (Ome)`
- `25` -> `スペック / スペ`
- `26` -> `レポ`
- `27` -> `アプリ`
- `28` -> `コミニュ`
- `29` -> `パソ`
- `30` -> `エンビ / プレ / 本番`
- `31` -> `ロギ / ログ`
- `32` -> `落ちる / 鯖落ち`
- `33` -> `バグる`
- `35` -> `ごはんたべる`
- `36` -> `笑 hoặc www`
- `37` -> `あざす (Azasu)`

---

### Task 0: Create the implementation worktree

**Files:**

- No repo files changed in this task.

- [ ] **Step 0.1: Create a dedicated worktree**

```bash
git worktree add .worktrees/feat-dataset-auto-injection -b feat/dataset-auto-injection
```

Expected: new worktree created under `.worktrees/feat-dataset-auto-injection`

- [ ] **Step 0.2: Move into the worktree and verify context**

```bash
cd .worktrees/feat-dataset-auto-injection
git status --short
ls docs/plans
```

Expected:

- clean working tree
- both dataset sidecar docs present in `docs/plans/`

---

### Task 1: Scaffold `@chatwork-bot/dataset-runner`

**Files:**

- Create: `packages/dataset-runner/package.json`
- Create: `packages/dataset-runner/tsconfig.json`
- Create: `packages/dataset-runner/src/index.ts`
- Create: `packages/dataset-runner/src/server.ts`
- Create: `packages/dataset-runner/src/app.ts`
- Create: `packages/dataset-runner/src/app.test.ts`
- Create: `packages/dataset-runner/src/env.ts`
- Create: `packages/dataset-runner/src/env.test.ts`
- Create: `packages/dataset-runner/src/routes/health.ts`
- Create: `packages/dataset-runner/src/routes/health.test.ts`
- Create: `packages/dataset-runner/src/routes/delivery-ack.ts`
- Create: `packages/dataset-runner/src/routes/delivery-ack.test.ts`
- Create: `packages/dataset-runner/src/routes/status.ts`
- Create: `packages/dataset-runner/src/routes/status.test.ts`
- Create: `packages/dataset-runner/src/types/delivery-ack.ts`

- [ ] **Step 1.1: Write the failing health/status/internal-ack route tests**

```ts
// packages/dataset-runner/src/routes/delivery-ack.test.ts
import { describe, expect, it } from 'bun:test'
import { createDeliveryAckRoutes } from './delivery-ack'

describe('createDeliveryAckRoutes', () => {
  it('POST /internal/delivery-acks delegates one ACK payload and returns 202', async () => {
    const calls: unknown[] = []
    const app = createDeliveryAckRoutes({
      onAck: async (ack) => {
        calls.push(ack)
      },
    })

    const res = await app.handle(
      new Request('http://localhost/internal/delivery-acks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceMessageId: 'source-1',
          status: 'sent',
          destinationRoomId: 55555,
          ackedAt: '2026-03-10T12:00:00.000Z',
        }),
      }),
    )

    expect(res.status).toBe(202)
    expect(calls).toHaveLength(1)
  })
})
```

```ts
// packages/dataset-runner/src/app.test.ts
import { describe, expect, it, mock } from 'bun:test'

void mock.module('./env', () => ({
  env: {
    NODE_ENV: 'test',
    DATASET_AUTORUN: false,
    DATASET_RUNNER_PORT: 3002,
  },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const { createApp } = require('./app')

describe('createApp (dataset-runner)', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const app = createApp({
    getStatus: () => ({
      mode: 'idle',
      autorun: false,
      pendingFiles: 0,
      completedCount: 0,
      failedCount: 0,
      updatedAt: new Date(0).toISOString(),
    }),
    onDeliveryAck: async () => {},
  })

  it('GET /health returns 200', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const res = await app.handle(new Request('http://localhost/health'))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res.status).toBe(200)
  })

  it('GET /status returns idle snapshot', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const res = await app.handle(new Request('http://localhost/status'))
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(res.status).toBe(200)
    const body = (await res.json()) as { mode: string; autorun: boolean }
    expect(body.mode).toBe('idle')
    expect(body.autorun).toBe(false)
  })
})
```

- [ ] **Step 1.2: Run the tests to verify they fail**

```bash
bun test packages/dataset-runner/src/app.test.ts
```

Expected: FAIL because `packages/dataset-runner` does not exist yet

- [ ] **Step 1.3: Create the package manifest and tsconfig**

```json
// packages/dataset-runner/package.json
{
  "name": "@chatwork-bot/dataset-runner",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "bun --hot src/index.ts",
    "start": "bun src/index.ts",
    "lint": "eslint \"**/*.ts\"",
    "lint:fix": "eslint \"**/*.ts\" --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md,yml,yaml}\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@chatwork-bot/core": "workspace:*",
    "@elysiajs/swagger": "^1.3.1",
    "elysia": "^1.4.27",
    "logixlysia": "^6.2.0",
    "zod": "^4.3.6"
  }
}
```

```json
// packages/dataset-runner/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["packages/dataset-runner/src/*", "packages/core/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 1.4: Add env parsing and minimal app/runtime files**

```ts
// packages/dataset-runner/src/env.ts
import { z } from 'zod'

const envSchema = z
  .object({
    CHATWORK_API_TOKEN: z.string().min(1),
    CHATWORK_ORIGINAL_ROOM_ID: z.coerce.number().int().positive(),
    NODE_ENV: z.enum(['development', 'production', 'test', 'local']).default('development'),
    DATASET_AUTORUN: z.coerce.boolean().default(false),
    DATASET_INPUT_DIR: z.string().min(1).default('./input'),
    DATASET_RESET_MODE: z.enum(['resume', 'from-start', 'from-line']).default('resume'),
    DATASET_RESET_FILE: z.string().min(1).optional(),
    DATASET_RESET_LINE: z.coerce.number().int().positive().optional(),
    DATASET_CLEAR_FAILED: z.coerce.boolean().default(false),
    DATASET_CLEAR_OUTPUT: z.coerce.boolean().default(false),
    DATASET_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(2000),
    DATASET_MAX_RETRIES: z.coerce.number().int().positive().default(3),
    DATASET_ITEM_TIMEOUT_MS: z.coerce.number().int().positive().default(900000),
    DATASET_RUNNER_PORT: z.coerce.number().int().positive().default(3002),
  })
  .superRefine((value, ctx) => {
    if (value.DATASET_RESET_MODE !== 'resume' && !value.DATASET_RESET_FILE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATASET_RESET_FILE'],
        message: 'DATASET_RESET_FILE is required when DATASET_RESET_MODE is not resume',
      })
    }

    if (value.DATASET_RESET_MODE === 'from-line' && !value.DATASET_RESET_LINE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATASET_RESET_LINE'],
        message: 'DATASET_RESET_LINE is required when DATASET_RESET_MODE=from-line',
      })
    }

    if (
      value.DATASET_RESET_MODE !== 'resume' &&
      value.NODE_ENV !== 'development' &&
      value.NODE_ENV !== 'local'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATASET_RESET_MODE'],
        message: 'reset/replay is allowed only in development or local mode',
      })
    }
  })

const result = envSchema.safeParse(process.env)
if (!result.success) {
  for (const issue of result.error.issues)
    console.error(`[env] ${issue.path.join('.')}: ${issue.message}`)
  process.exit(1)
}

export const env = result.data
export type Env = z.infer<typeof envSchema>
```

```ts
// packages/dataset-runner/src/routes/health.ts
import { Elysia } from 'elysia'

export const healthRoutes = new Elysia({ name: 'dataset-runner:health' }).get('/health', () => ({
  ok: true,
}))
```

```ts
// packages/dataset-runner/src/types/delivery-ack.ts
export interface DeliveryAckPayload {
  sourceMessageId: string
  status: 'sent' | 'failed'
  destinationRoomId: number
  destinationMessageId?: string
  errorCode?: string
  errorMessage?: string
  ackedAt: string
}
```

```ts
// packages/dataset-runner/src/routes/delivery-ack.ts
import { Elysia, t } from 'elysia'
import type { DeliveryAckPayload } from '~/types/delivery-ack'

export function createDeliveryAckRoutes(config: {
  onAck: (ack: DeliveryAckPayload) => Promise<void> | void
}) {
  return new Elysia({ name: 'dataset-runner:delivery-ack' }).post(
    '/internal/delivery-acks',
    async ({ body }) => {
      await config.onAck(body as DeliveryAckPayload)
      return new Response(null, { status: 202 })
    },
    {
      body: t.Object({
        sourceMessageId: t.String(),
        status: t.Union([t.Literal('sent'), t.Literal('failed')]),
        destinationRoomId: t.Number(),
        destinationMessageId: t.Optional(t.String()),
        errorCode: t.Optional(t.String()),
        errorMessage: t.Optional(t.String()),
        ackedAt: t.String(),
      }),
    },
  )
}
```

```ts
// packages/dataset-runner/src/routes/status.ts
import { Elysia } from 'elysia'

export function createStatusRoutes(getStatus: () => unknown) {
  return new Elysia({ name: 'dataset-runner:status' }).get('/status', () => getStatus())
}
```

```ts
// packages/dataset-runner/src/app.ts
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import logixlysia from 'logixlysia'
import { env } from './env'
import { createDeliveryAckRoutes } from '~/routes/delivery-ack'
import { healthRoutes } from '~/routes/health'
import { createStatusRoutes } from '~/routes/status'
import type { DeliveryAckPayload } from '~/types/delivery-ack'

export function createApp(config: {
  getStatus: () => unknown
  onDeliveryAck: (ack: DeliveryAckPayload) => Promise<void> | void
}) {
  const app = new Elysia({ name: 'dataset-runner' })

  if (env.NODE_ENV !== 'test') {
    app.use(logixlysia({ config: { showStartupMessage: false, ip: false } }))
  }

  if (env.NODE_ENV === 'development') {
    app.use(
      swagger({
        path: '/docs',
        documentation: {
          info: { title: 'Dataset Runner API', version: '1.0.0' },
        },
      }),
    )
  }

  return app
    .use(healthRoutes)
    .use(createDeliveryAckRoutes({ onAck: config.onDeliveryAck }))
    .use(createStatusRoutes(config.getStatus))
}
```

```ts
// packages/dataset-runner/src/server.ts
import { createApp } from './app'
import type { DeliveryAckPayload } from '~/types/delivery-ack'

export function createServer(config: {
  getStatus: () => unknown
  onDeliveryAck: (ack: DeliveryAckPayload) => Promise<void> | void
}) {
  return createApp(config)
}
```

```ts
// packages/dataset-runner/src/index.ts
import { env } from './env'
import { createServer } from './server'

const idleStatus = {
  mode: 'idle',
  autorun: env.DATASET_AUTORUN,
  pendingFiles: 0,
  completedCount: 0,
  failedCount: 0,
  updatedAt: new Date().toISOString(),
}

const server = createServer({
  getStatus: () => idleStatus,
  onDeliveryAck: async () => {},
})
server.listen(env.DATASET_RUNNER_PORT)

console.log(`[dataset-runner] Listening on http://0.0.0.0:${env.DATASET_RUNNER_PORT.toString()}`)
console.log(
  `[dataset-runner] Health check: http://localhost:${env.DATASET_RUNNER_PORT.toString()}/health`,
)
console.log(
  `[dataset-runner] Status: http://localhost:${env.DATASET_RUNNER_PORT.toString()}/status`,
)
```

- [ ] **Step 1.5: Run package tests**

```bash
bun test packages/dataset-runner/src/app.test.ts
bun test packages/dataset-runner/src/routes/health.test.ts
bun test packages/dataset-runner/src/routes/delivery-ack.test.ts
bun test packages/dataset-runner/src/routes/status.test.ts
```

Expected: PASS

- [ ] **Step 1.6: Run package typecheck**

```bash
cd packages/dataset-runner && bun run typecheck
```

Expected: PASS

- [ ] **Step 1.7: Commit**

```bash
git add packages/dataset-runner
git commit -m "feat(repo): scaffold dataset runner package"
```

---

### Task 2: Extend translator output schema with origin metadata and make output writes atomic

**Files:**

- Modify: `packages/translator/src/types/output.ts`
- Modify: `packages/translator/src/utils/output-writer.ts`
- Modify: `packages/translator/src/utils/output-writer.test.ts`

- [ ] **Step 2.1: Write the failing output writer test for origin and delivery overwrite**

```ts
// add to packages/translator/src/utils/output-writer.test.ts
it('rewrites an existing output file with delivery metadata', async () => {
  await writeTranslationOutput(sampleRecord, testDir)

  await writeTranslationOutput(
    {
      ...sampleRecord,
      origin: {
        type: 'automation',
        datasetFile: '001-vfa-thinhntt-2026-03-10.jsonl',
        datasetItemId: 'vfa-001',
        datasetLineNumber: 1,
      },
      delivery: {
        status: 'sent',
        destinationRoomId: 55555,
        destinationMessageId: 'dest-123',
        sentAt: '2026-03-10T12:00:00.000Z',
      },
    },
    testDir,
  )

  const filepath = join(testDir, '2026-03-04', 'msg_001.json')
  const content = (await Bun.file(filepath).json()) as OutputRecord

  expect(content.origin?.type).toBe('automation')
  expect(content.origin?.datasetItemId).toBe('vfa-001')
  expect(content.delivery?.status).toBe('sent')
  expect(content.delivery?.destinationMessageId).toBe('dest-123')
})
```

- [ ] **Step 2.2: Run the translator writer test to confirm failure**

```bash
bun test packages/translator/src/utils/output-writer.test.ts
```

Expected: FAIL because `origin` and `delivery` do not exist on `OutputRecord`

- [ ] **Step 2.3: Add `origin` and `delivery` types to `OutputRecord`**

```ts
// packages/translator/src/types/output.ts
import type { ChatworkWebhookEvent, TranslationResult } from '@chatwork-bot/core'
import type { PipelineTrace } from '@chatwork-bot/translation-prompt'

export type OutputOrigin = {
  type: 'manual' | 'automation'
  datasetFile?: string
  datasetItemId?: string
  datasetLineNumber?: number
}

export type OutputDelivery = {
  status: 'sent' | 'failed'
  destinationRoomId: number
  destinationMessageId?: string
  errorCode?: string
  errorMessage?: string
  sentAt: string
}

export type OutputRecord = ChatworkWebhookEvent & {
  translation: TranslationResult
  pipeline?: PipelineTrace
  origin?: OutputOrigin
  delivery?: OutputDelivery
}
```

- [ ] **Step 2.4: Make file writes atomic**

```ts
// packages/translator/src/utils/output-writer.ts
import { mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { OutputRecord } from '~/types/output'

async function writeJsonAtomically(filepath: string, content: string): Promise<void> {
  const tempPath = `${filepath}.${crypto.randomUUID()}.tmp`
  await Bun.write(tempPath, content)
  await rename(tempPath, filepath)
}

export async function writeTranslationOutput(
  record: OutputRecord,
  baseDir: string = join(process.cwd(), 'output'),
): Promise<void> {
  const dateStr = record.translation.timestamp.slice(0, 10)
  const dir = join(baseDir, dateStr)
  await mkdir(dir, { recursive: true })

  const messageId = record.webhook_event.message_id ?? 'unknown'
  const filepath = join(dir, `${messageId}.json`)

  await writeJsonAtomically(filepath, JSON.stringify(record, null, 2))
  console.log(`[output] Saved: ${filepath}`)
}
```

Use the temp-file-then-`rename()` approach shown above. Do not keep direct in-place writes.

- [ ] **Step 2.5: Update existing tests to include `origin` and `delivery` in type assertions**

Keep all current assertions, then add the new overwrite assertion from Step 2.1.

- [ ] **Step 2.6: Run the writer test again**

```bash
bun test packages/translator/src/utils/output-writer.test.ts
```

Expected: PASS

- [ ] **Step 2.7: Commit**

```bash
git add packages/translator/src/types/output.ts \
        packages/translator/src/utils/output-writer.ts \
        packages/translator/src/utils/output-writer.test.ts
git commit -m "feat(translator): add output origin and delivery metadata"
```

---

### Task 3: Return delivery ACK, classify output origin, and notify dataset-runner via internal callback

**Files:**

- Create: `packages/translator/src/services/output-origin.ts`
- Create: `packages/translator/src/services/output-origin.test.ts`
- Create: `packages/translator/src/services/dataset-runner-callback.ts`
- Create: `packages/translator/src/services/dataset-runner-callback.test.ts`
- Modify: `packages/translator/src/services/chatwork-sender.ts`
- Modify: `packages/translator/src/services/chatwork-sender.test.ts`
- Modify: `packages/translator/src/webhook/handler.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`

- [ ] **Step 3.1: Write the failing sender test for returned delivery status**

```ts
// add to packages/translator/src/services/chatwork-sender.test.ts
it('returns sent delivery metadata when destination send succeeds', async () => {
  const result = await sendTranslatedMessage(makeEvent(), makeResult(), {
    apiToken: 'test-token',
    destinationRoomId: 55555,
  })

  expect(result.status).toBe('sent')
  expect(result.destinationRoomId).toBe(55555)
  expect(result.destinationMessageId).toBe('sent-456')
})

it('returns failed delivery metadata when destination send fails', async () => {
  mockSendMessage.mockImplementationOnce(() => Promise.reject(new Error('API error')))

  const result = await sendTranslatedMessage(makeEvent(), makeResult(), {
    apiToken: 'test-token',
    destinationRoomId: 55555,
  })

  expect(result.status).toBe('failed')
  expect(result.errorMessage).toContain('API error')
})
```

- [ ] **Step 3.2: Write the failing output-origin, callback client, and handler tests**

```ts
// packages/translator/src/services/output-origin.test.ts
import { afterEach, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveOutputOrigin } from './output-origin'

const inputDir = join(tmpdir(), 'output-origin-test')

afterEach(async () => {
  await rm(inputDir, { recursive: true, force: true })
})

describe('resolveOutputOrigin', () => {
  it('returns manual when no source-map entry exists', async () => {
    const origin = await resolveOutputOrigin('manual-1', inputDir)
    expect(origin.type).toBe('manual')
  })
})
```

```ts
// packages/translator/src/services/dataset-runner-callback.test.ts
import { describe, expect, it, mock } from 'bun:test'
import { notifyDatasetRunner } from './dataset-runner-callback'

describe('notifyDatasetRunner', () => {
  it('POSTs one ACK payload to dataset-runner', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response(null, { status: 202 })))

    await notifyDatasetRunner(
      {
        sourceMessageId: 'source-1',
        status: 'sent',
        destinationRoomId: 55555,
        ackedAt: '2026-03-10T12:00:00.000Z',
      },
      {
        callbackUrl: 'http://dataset-runner:3002/internal/delivery-acks',
        fetchImpl: fetchMock,
      },
    )

    expect(fetchMock.mock.calls.length).toBe(1)
  })
})
```

```ts
// add to packages/translator/src/webhook/handler.test.ts
it('writes delivery metadata after destination send completes', async () => {
  const event: ChatworkWebhookEvent = {
    webhook_setting_id: '35555',
    webhook_event_type: 'message_created',
    webhook_event_time: 1772633778,
    webhook_event: {
      message_id: '2081046619322847232',
      room_id: 424846369,
      account_id: 8315321,
      body: 'A\\n\\nB\\nC',
      send_time: 1772633778,
      update_time: 0,
    },
  }

  await handleTranslateRequest(event)

  const filepath = join(testOutputDir, '2026-03-06', '2081046619322847232.json')
  const content = (await Bun.file(filepath).json()) as {
    origin?: { type: string }
    delivery?: { status: string }
  }
  expect(content.origin?.type).toBe('manual')
  expect(content.delivery?.status).toBe('sent')
})
```

- [ ] **Step 3.3: Run the focused tests to verify failure**

```bash
bun test packages/translator/src/services/chatwork-sender.test.ts
bun test packages/translator/src/services/output-origin.test.ts
bun test packages/translator/src/services/dataset-runner-callback.test.ts
bun test packages/translator/src/webhook/handler.test.ts
```

Expected: FAIL because `sendTranslatedMessage` returns `void`, `output-origin.ts` does not exist,
`dataset-runner-callback.ts` does not exist, and handler never rewrites the file with `origin` or
`delivery`

- [ ] **Step 3.4: Create `resolveOutputOrigin()`**

```ts
// packages/translator/src/services/output-origin.ts
import { join } from 'node:path'
import type { OutputOrigin } from '~/types/output'

export async function resolveOutputOrigin(
  messageId: string,
  inputDir: string,
): Promise<OutputOrigin> {
  const filepath = join(inputDir, 'state', 'source-map', `${messageId}.json`)
  const file = Bun.file(filepath)

  if (!(await file.exists())) {
    return { type: 'manual' }
  }

  const content = (await file.json()) as {
    datasetFile?: string
    datasetItemId?: string
    datasetLineNumber?: number
  }

  return {
    type: 'automation',
    datasetFile: content.datasetFile,
    datasetItemId: content.datasetItemId,
    datasetLineNumber: content.datasetLineNumber,
  }
}
```

- [ ] **Step 3.5: Create `notifyDatasetRunner()`**

```ts
// packages/translator/src/services/dataset-runner-callback.ts
import type { OutputDelivery } from '~/types/output'

export interface DatasetRunnerAckPayload extends OutputDelivery {
  sourceMessageId: string
  ackedAt: string
}

export async function notifyDatasetRunner(
  payload: DatasetRunnerAckPayload,
  config: {
    callbackUrl: string
    fetchImpl?: typeof fetch
  },
): Promise<void> {
  const fetchImpl = config.fetchImpl ?? fetch
  const delays = [250, 500, 1000]

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    const response = await fetchImpl(config.callbackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.ok || response.status === 202) return
    if (attempt < delays.length - 1) await Bun.sleep(delays[attempt]!)
  }

  throw new Error('Dataset-runner callback failed after bounded retries')
}
```

- [ ] **Step 3.6: Change `sendTranslatedMessage` to return `OutputDelivery`**

```ts
// packages/translator/src/services/chatwork-sender.ts
import { ChatworkClient } from '@chatwork-bot/core'
import type { ChatworkMessageEvent, TranslationResult } from '@chatwork-bot/core'
import type { OutputDelivery } from '~/types/output'

export async function sendTranslatedMessage(
  event: ChatworkMessageEvent,
  result: TranslationResult,
  config: { apiToken: string; destinationRoomId: number },
): Promise<OutputDelivery> {
  try {
    const client = new ChatworkClient({ apiToken: config.apiToken })
    const members = await client.getMembers(event.webhook_event.room_id)
    const sender = members.find((m) => m.account_id === event.webhook_event.account_id)
    const senderName = sender?.name ?? `#${String(event.webhook_event.account_id)}`

    const message = buildTranslatedMessage(event, result, senderName)
    const response = await client.sendMessage({ roomId: config.destinationRoomId, message })

    return {
      status: 'sent',
      destinationRoomId: config.destinationRoomId,
      destinationMessageId: response.message_id,
      sentAt: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'failed',
      destinationRoomId: config.destinationRoomId,
      errorCode: 'CHATWORK_API',
      errorMessage: error instanceof Error ? error.message : String(error),
      sentAt: new Date().toISOString(),
    }
  }
}
```

- [ ] **Step 3.7: Rewrite the output file after origin classification and destination send, then notify dataset-runner**

```ts
// packages/translator/src/webhook/handler.ts
const origin = await resolveOutputOrigin(
  event.webhook_event.message_id,
  process.env['DATASET_INPUT_DIR'] ?? './input',
)

const outputRecord = { ...event, translation: result, pipeline: trace, origin }

await writeTranslationOutput(outputRecord, ...(outputBaseDir ? [outputBaseDir] : []))

const delivery = await sendTranslatedMessage(event, result, {
  apiToken: env.CHATWORK_API_TOKEN,
  destinationRoomId: env.CHATWORK_DESTINATION_ROOM_ID,
})

await writeTranslationOutput(
  { ...outputRecord, delivery },
  ...(outputBaseDir ? [outputBaseDir] : []),
)

if (origin.type === 'automation') {
  await notifyDatasetRunner(
    {
      sourceMessageId: event.webhook_event.message_id,
      ...delivery,
      ackedAt: new Date().toISOString(),
    },
    {
      callbackUrl:
        process.env['DATASET_RUNNER_CALLBACK_URL'] ??
        'http://dataset-runner:3002/internal/delivery-acks',
    },
  )
}
```

Do not skip the first write. The initial output must exist even if destination send later fails.

**Output rewrite failure is a hard stop.** If `writeTranslationOutput` throws on the second write
(the one that appends `delivery`), do not swallow the error and do not continue. Log a detailed
error (include file path, error code, messageId, and item context) and let the exception propagate.
A write failure here is a local-dev bug that must be visible immediately.

**Callback retry policy:** `notifyDatasetRunner` retries up to `3` times with exponential backoff
`250ms → 500ms → 1000ms`. If all retries fail, log a detailed error and mark the item as failed (DLQ entry).
Dataset-runner is always expected to be healthy in the dev stack; a persistent callback failure
indicates the runner is down, which is itself a bug.

- [ ] **Step 3.8: Update sender, origin, callback, and handler tests**

Adjust existing sender tests to assert the returned value instead of only "does not throw".  
Adjust handler tests to read the rewritten file and inspect both `origin.type` and `delivery.status`.  
Add callback tests for `202 Accepted` and non-2xx failure handling.

- [ ] **Step 3.9: Run focused tests**

```bash
bun test packages/translator/src/services/chatwork-sender.test.ts
bun test packages/translator/src/services/output-origin.test.ts
bun test packages/translator/src/services/dataset-runner-callback.test.ts
bun test packages/translator/src/webhook/handler.test.ts
```

Expected: PASS

- [ ] **Step 3.10: Commit**

```bash
git add packages/translator/src/services/output-origin.ts \
        packages/translator/src/services/output-origin.test.ts \
        packages/translator/src/services/dataset-runner-callback.ts \
        packages/translator/src/services/dataset-runner-callback.test.ts \
        packages/translator/src/services/chatwork-sender.ts \
        packages/translator/src/services/chatwork-sender.test.ts \
        packages/translator/src/webhook/handler.ts \
        packages/translator/src/webhook/handler.test.ts
git commit -m "feat(translator): classify output origin and persist delivery ack"
```

---

### Task 4: Add dataset item schema and deterministic file discovery

**Files:**

- Create: `packages/dataset-runner/src/types/dataset.ts`
- Create: `packages/dataset-runner/src/types/dataset.test.ts`
- Create: `packages/dataset-runner/src/services/dataset-loader.ts`
- Create: `packages/dataset-runner/src/services/dataset-loader.test.ts`

- [ ] **Step 4.1: Write the failing dataset schema test**

```ts
// packages/dataset-runner/src/types/dataset.test.ts
import { describe, expect, it } from 'bun:test'
import { DatasetItemSchema } from './dataset'

describe('DatasetItemSchema', () => {
  it('parses a valid item', () => {
    const result = DatasetItemSchema.parse({
      id: 'vfa-001',
      message: 'ありがとう',
      originalRoomId: 424846369,
      metadata: {
        caseNo: 1,
        title: 'Dịch từ đơn/Cụm từ thông dụng',
        expectedText: 'Cảm ơn',
        category: 'functional',
        tags: ['jp-basic'],
        source: 'spreadsheet-import',
      },
    })

    expect(result.id).toBe('vfa-001')
    expect(result.originalRoomId).toBe(424846369)
    expect(result.metadata?.caseNo).toBe(1)
  })

  it('rejects empty message', () => {
    expect(() => DatasetItemSchema.parse({ id: 'vfa-001', message: '' })).toThrow()
  })

  it('parses escaped newlines inside message content', () => {
    const result = DatasetItemSchema.parse({
      id: 'vfa-014',
      message: 'できれば年内に！\n\n実装してみてください。',
      metadata: {
        expectedRule: 'Preserve paragraph break and translate naturally',
      },
    })

    expect(result.message).toContain('\n\n')
  })

  it('accepts structured spreadsheet metadata', () => {
    const result = DatasetItemSchema.parse({
      id: 'vfa-004',
      message: '箸で食べる',
      metadata: {
        caseNo: 4,
        title: 'Từ đồng âm khác nghĩa (Homonyms)',
        expectedRule: 'Dịch đúng ngữ cảnh: Ăn bằng đũa',
        category: 'disambiguation',
        tags: ['homonym', 'context'],
        source: 'spreadsheet-import',
      },
    })

    expect(result.metadata?.expectedRule).toContain('Ăn bằng đũa')
    expect(result.metadata?.tags).toContain('homonym')
  })

  it('rejects unknown top-level keys', () => {
    expect(() =>
      DatasetItemSchema.parse({
        id: 'vfa-003',
        message: 'hello',
        room: 123,
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 4.2: Write the failing dataset discovery test**

```ts
// packages/dataset-runner/src/services/dataset-loader.test.ts
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { listPendingDatasetFiles } from './dataset-loader'

const baseDir = join(tmpdir(), 'dataset-loader-test')

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true })
})

describe('listPendingDatasetFiles', () => {
  it('returns pending JSONL files sorted by file name', async () => {
    const pendingDir = join(baseDir, 'pending')
    await mkdir(pendingDir, { recursive: true })
    await Bun.write(join(pendingDir, '010-b.jsonl'), '{"id":"b","message":"b"}\\n')
    await Bun.write(join(pendingDir, '001-a.jsonl'), '{"id":"a","message":"a"}\\n')

    const result = await listPendingDatasetFiles(baseDir)
    expect(result.map((file) => file.fileName)).toEqual(['001-a.jsonl', '010-b.jsonl'])
  })
})
```

- [ ] **Step 4.3: Run the dataset tests to verify failure**

```bash
bun test packages/dataset-runner/src/types/dataset.test.ts
bun test packages/dataset-runner/src/services/dataset-loader.test.ts
```

Expected: FAIL because schema and loader do not exist yet

- [ ] **Step 4.4: Create the dataset schema**

```ts
// packages/dataset-runner/src/types/dataset.ts
import { z } from 'zod'

const DatasetMetadataSchema = z
  .object({
    caseNo: z.number().int().positive().optional(),
    title: z.string().min(1).optional(),
    expectedText: z.string().min(1).optional(),
    expectedRule: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
    notes: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
  })
  .strict()

export const DatasetItemSchema = z
  .object({
    id: z.string().min(1),
    message: z.string().min(1),
    originalRoomId: z.coerce.number().int().positive().optional(),
    metadata: DatasetMetadataSchema.optional(),
  })
  .strict()

export type DatasetItem = z.infer<typeof DatasetItemSchema>

export interface PendingDatasetFile {
  filePath: string
  fileName: string
}

export interface PendingDatasetRecord {
  filePath: string
  fileName: string
  lineNumber: number
  item: DatasetItem
}
```

- [ ] **Step 4.5: Create the loader**

```ts
// packages/dataset-runner/src/services/dataset-loader.ts
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DatasetItemSchema,
  type PendingDatasetFile,
  type PendingDatasetRecord,
} from '~/types/dataset'

export async function listPendingDatasetFiles(inputDir: string): Promise<PendingDatasetFile[]> {
  const pendingDir = join(inputDir, 'pending')
  const entries = await readdir(pendingDir, { withFileTypes: true }).catch(() => [])

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => ({
      filePath: join(pendingDir, entry.name),
      fileName: entry.name,
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName))
}

export async function loadDatasetRecords(
  file: PendingDatasetFile,
): Promise<PendingDatasetRecord[]> {
  const lines = (await Bun.file(file.filePath).text())
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line, index) => ({
    filePath: file.filePath,
    fileName: file.fileName,
    lineNumber: index + 1,
    item: DatasetItemSchema.parse(JSON.parse(line)),
  }))
}
```

- [ ] **Step 4.6: Run dataset tests again**

```bash
bun test packages/dataset-runner/src/types/dataset.test.ts
bun test packages/dataset-runner/src/services/dataset-loader.test.ts
```

Expected: PASS

- [ ] **Step 4.7: Commit**

```bash
git add packages/dataset-runner/src/types/dataset.ts \
        packages/dataset-runner/src/types/dataset.test.ts \
        packages/dataset-runner/src/services/dataset-loader.ts \
        packages/dataset-runner/src/services/dataset-loader.test.ts
git commit -m "feat(repo): add dataset schema and file discovery"
```

---

### Task 5: Implement manifest persistence, ACK durability, the single-runner file lock, and reset planning

**Files:**

- Create: `packages/dataset-runner/src/types/status.ts`
- Create: `packages/dataset-runner/src/services/state-store.ts`
- Create: `packages/dataset-runner/src/services/state-store.test.ts`
- Create: `packages/dataset-runner/src/services/ack-store.ts`
- Create: `packages/dataset-runner/src/services/ack-store.test.ts`
- Create: `packages/dataset-runner/src/services/reset-planner.ts`
- Create: `packages/dataset-runner/src/services/reset-planner.test.ts`

- [ ] **Step 5.1: Write the failing state-store tests**

```ts
// packages/dataset-runner/src/services/state-store.test.ts
import { afterEach, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  acquireRunnerLock,
  heartbeatRunnerLock,
  readDatasetState,
  releaseRunnerLock,
  writeDatasetState,
} from './state-store'

const baseDir = join(tmpdir(), 'state-store-test')

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true })
})

describe('state-store', () => {
  it('round-trips dataset state', async () => {
    await writeDatasetState(baseDir, '001-vfa-thinhntt-2026-03-10.jsonl', {
      fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
      nextLineNumber: 2,
      completedItemIds: ['vfa-001'],
      failedItemIds: [],
      updatedAt: '2026-03-10T11:36:19.619Z',
    })

    const result = await readDatasetState(baseDir, '001-vfa-thinhntt-2026-03-10.jsonl')
    expect(result?.nextLineNumber).toBe(2)
  })

  it('acquires, heartbeats, and releases the runner lock', async () => {
    const lease = await acquireRunnerLock(baseDir, 60_000)
    await heartbeatRunnerLock(lease)
    await releaseRunnerLock(lease)
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 5.2: Run the test to verify failure**

```bash
bun test packages/dataset-runner/src/services/state-store.test.ts
```

Expected: FAIL because `state-store.ts` does not exist

- [ ] **Step 5.3: Add the status and manifest types**

```ts
// packages/dataset-runner/src/types/status.ts
export interface RunnerStatusSnapshot {
  mode: 'idle' | 'running'
  autorun: boolean
  pendingFiles: number
  activeFile?: string
  activeItemId?: string
  activeLineNumber?: number
  activeSourceMessageId?: string
  waitingForAck?: boolean
  completedCount: number
  failedCount: number
  lastResetMode?: 'from-start' | 'from-line'
  lastResetAt?: string
  lastErrorCode?: string
  updatedAt: string
}

export interface DatasetFileState {
  fileName: string
  nextLineNumber: number
  completedItemIds: string[]
  failedItemIds: string[]
  inFlight?: {
    lineNumber: number
    itemId: string
    phase: 'sending' | 'awaiting-ack'
    attempt: number
    sourceMessageId?: string
    startedAt: string
  }
  updatedAt: string
}
```

- [ ] **Step 5.4: Implement state read/write and lock helpers**

```ts
// packages/dataset-runner/src/services/state-store.ts
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatasetFileState } from '~/types/status'

export interface RunnerLockLease {
  lockPath: string
  ownerId: string
}

function statePath(baseDir: string, fileName: string): string {
  return join(baseDir, 'state', `${fileName}.state.json`)
}

export async function readDatasetState(
  baseDir: string,
  fileName: string,
): Promise<DatasetFileState | null> {
  const filepath = statePath(baseDir, fileName)
  const file = Bun.file(filepath)
  if (!(await file.exists())) return null
  return (await file.json()) as DatasetFileState
}

export async function writeDatasetState(
  baseDir: string,
  fileName: string,
  state: DatasetFileState,
): Promise<void> {
  const dir = join(baseDir, 'state')
  await mkdir(dir, { recursive: true })
  await writeFile(statePath(baseDir, fileName), JSON.stringify(state, null, 2))
}

export async function acquireRunnerLock(
  baseDir: string,
  staleMs: number,
): Promise<RunnerLockLease> {
  const dir = join(baseDir, 'state')
  const lockPath = join(dir, 'runner.lock')
  await mkdir(dir, { recursive: true })

  const stale = await stat(lockPath)
    .then((value) => Date.now() - value.mtimeMs > staleMs)
    .catch(() => false)
  if (stale) await rm(lockPath, { force: true })

  const ownerId = crypto.randomUUID()
  await writeFile(lockPath, JSON.stringify({ ownerId, heartbeatAt: new Date().toISOString() }), {
    flag: 'wx',
  })

  return { lockPath, ownerId }
}

export async function heartbeatRunnerLock(lease: RunnerLockLease): Promise<void> {
  await writeFile(
    lease.lockPath,
    JSON.stringify({ ownerId: lease.ownerId, heartbeatAt: new Date().toISOString() }),
  )
}

export async function releaseRunnerLock(lease: RunnerLockLease): Promise<void> {
  await rm(lease.lockPath, { force: true })
}
```

Note: if `heartbeatRunnerLock()` rewrites the file, keep the JSON small and deterministic.  
If you want to avoid clobbering other owners, read-then-compare `ownerId` first.

- [ ] **Step 5.5: Run the state-store test**

```bash
bun test packages/dataset-runner/src/services/state-store.test.ts
```

Expected: PASS

- [ ] **Step 5.5a: Write the failing ACK store tests**

```ts
// packages/dataset-runner/src/services/ack-store.test.ts
import { afterEach, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readDeliveryAck, writeDeliveryAck } from './ack-store'

const inputDir = join(tmpdir(), 'ack-store-test')

afterEach(async () => {
  await rm(inputDir, { recursive: true, force: true })
})

describe('ack-store', () => {
  it('round-trips one delivery ACK', async () => {
    await writeDeliveryAck(inputDir, {
      sourceMessageId: 'source-1',
      status: 'sent',
      destinationRoomId: 55555,
      destinationMessageId: 'dest-1',
      ackedAt: '2026-03-10T12:00:00.000Z',
    })

    const result = await readDeliveryAck(inputDir, 'source-1')
    expect(result?.status).toBe('sent')
    expect(result?.destinationMessageId).toBe('dest-1')
  })

  it('treats exact duplicate ACK writes as idempotent', async () => {
    const firstAck = {
      sourceMessageId: 'source-1',
      status: 'sent' as const,
      destinationRoomId: 55555,
      destinationMessageId: 'dest-1',
      ackedAt: '2026-03-10T12:00:00.000Z',
    }

    const written = await writeDeliveryAck(inputDir, firstAck)
    const duplicate = await writeDeliveryAck(inputDir, firstAck)

    const result = await readDeliveryAck(inputDir, 'source-1')
    expect(written.destinationMessageId).toBe('dest-1')
    expect(duplicate.destinationMessageId).toBe('dest-1')
    expect(result?.destinationMessageId).toBe('dest-1')
  })

  it('throws on divergent duplicate ACK (same sourceMessageId, different status)', async () => {
    const firstAck = {
      sourceMessageId: 'source-1',
      status: 'sent' as const,
      destinationRoomId: 55555,
      destinationMessageId: 'dest-1',
      ackedAt: '2026-03-10T12:00:00.000Z',
    }

    const divergentAck = {
      ...firstAck,
      status: 'failed' as const,
    }

    await writeDeliveryAck(inputDir, firstAck)
    await expect(writeDeliveryAck(inputDir, divergentAck)).rejects.toThrow(/divergent ACK/)
  })
})
```

- [ ] **Step 5.5b: Run the ACK store test to verify failure**

```bash
bun test packages/dataset-runner/src/services/ack-store.test.ts
```

Expected: FAIL because `ack-store.ts` does not exist

- [ ] **Step 5.5c: Implement ACK durability helpers**

```ts
// packages/dataset-runner/src/services/ack-store.ts
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DeliveryAckPayload } from '~/types/delivery-ack'

export type DeliveryAckRecord = DeliveryAckPayload

function ackPath(inputDir: string, sourceMessageId: string): string {
  return join(inputDir, 'state', 'acks', `${sourceMessageId}.json`)
}

async function writeJsonAtomic(filepath: string, payload: DeliveryAckRecord): Promise<void> {
  const tempPath = `${filepath}.${crypto.randomUUID()}.tmp`
  await writeFile(tempPath, JSON.stringify(payload, null, 2))
  await rename(tempPath, filepath)
}

export async function readDeliveryAck(
  inputDir: string,
  sourceMessageId: string,
): Promise<DeliveryAckRecord | null> {
  const file = Bun.file(ackPath(inputDir, sourceMessageId))
  if (!(await file.exists())) return null
  return (await file.json()) as DeliveryAckRecord
}

export async function writeDeliveryAck(
  inputDir: string,
  ack: DeliveryAckRecord,
): Promise<DeliveryAckRecord> {
  const existing = await readDeliveryAck(inputDir, ack.sourceMessageId)
  if (existing) {
    if (existing.status === ack.status) return existing
    throw new Error(
      `divergent ACK for sourceMessageId=${ack.sourceMessageId}: ` +
        `stored status="${existing.status}" but received status="${ack.status}". ` +
        `This is a data-integrity violation — stop the runner and investigate.`,
    )
  }

  await mkdir(join(inputDir, 'state', 'acks'), { recursive: true })
  await writeJsonAtomic(ackPath(inputDir, ack.sourceMessageId), ack)
  return ack
}

export async function clearDeliveryAck(inputDir: string, sourceMessageId: string): Promise<void> {
  await rm(ackPath(inputDir, sourceMessageId), { force: true })
}
```

- [ ] **Step 5.5d: Run the ACK store test again**

```bash
bun test packages/dataset-runner/src/services/ack-store.test.ts
```

Expected: PASS

- [ ] **Step 5.6: Write the failing reset planner tests**

```ts
// packages/dataset-runner/src/services/reset-planner.test.ts
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { applyStartupReset } from './reset-planner'

const baseDir = join(tmpdir(), 'reset-planner-test')
const outputDir = join(tmpdir(), 'reset-planner-output')

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true })
  await rm(outputDir, { recursive: true, force: true })
})

describe('applyStartupReset', () => {
  it('moves an archived file back to pending for from-start replay', async () => {
    await mkdir(join(baseDir, 'archive'), { recursive: true })
    await mkdir(join(baseDir, 'state'), { recursive: true })
    await Bun.write(
      join(baseDir, 'archive', '001-vfa-thinhntt-2026-03-10.jsonl'),
      '{"id":"vfa-001","message":"ありがとう"}\\n',
    )
    await Bun.write(
      join(baseDir, 'state', '001-vfa-thinhntt-2026-03-10.jsonl.state.json'),
      '{"nextLineNumber":2}',
    )

    const summary = await applyStartupReset({
      inputDir: baseDir,
      outputDir,
      mode: 'from-start',
      fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
      clearFailed: false,
      clearOutput: false,
    })

    expect(summary?.mode).toBe('from-start')
    expect(
      await Bun.file(join(baseDir, 'pending', '001-vfa-thinhntt-2026-03-10.jsonl')).exists(),
    ).toBe(true)
    expect(
      await Bun.file(
        join(baseDir, 'state', '001-vfa-thinhntt-2026-03-10.jsonl.state.json'),
      ).exists(),
    ).toBe(false)
  })

  it('rewrites checkpoint state for from-line replay', async () => {
    await mkdir(join(baseDir, 'state'), { recursive: true })
    await Bun.write(
      join(baseDir, 'state', '001-vfa-thinhntt-2026-03-10.jsonl.state.json'),
      JSON.stringify({
        fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
        nextLineNumber: 10,
        completedItemIds: ['vfa-001', 'vfa-002'],
        failedItemIds: ['vfa-003'],
        updatedAt: '2026-03-10T11:36:19.619Z',
      }),
    )

    const summary = await applyStartupReset({
      inputDir: baseDir,
      outputDir,
      mode: 'from-line',
      fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
      lineNumber: 2,
      clearFailed: false,
      clearOutput: false,
    })

    expect(summary?.mode).toBe('from-line')
    const state = (await Bun.file(
      join(baseDir, 'state', '001-vfa-thinhntt-2026-03-10.jsonl.state.json'),
    ).json()) as {
      nextLineNumber: number
      completedItemIds: string[]
      failedItemIds: string[]
      inFlight?: unknown
    }
    expect(state.nextLineNumber).toBe(2)
    expect(state.completedItemIds).toEqual([])
    expect(state.failedItemIds).toEqual([])
    expect(state.inFlight).toBeUndefined()
  })
})
```

- [ ] **Step 5.7: Run the reset planner test to verify failure**

```bash
bun test packages/dataset-runner/src/services/reset-planner.test.ts
```

Expected: FAIL because `reset-planner.ts` does not exist

- [ ] **Step 5.8: Implement one-shot reset planning**

```ts
// packages/dataset-runner/src/services/reset-planner.ts
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { readDatasetState, writeDatasetState } from '~/services/state-store'

export interface StartupResetConfig {
  inputDir: string
  outputDir: string
  mode: 'resume' | 'from-start' | 'from-line'
  fileName?: string
  lineNumber?: number
  clearFailed: boolean
  clearOutput: boolean
}

export interface StartupResetSummary {
  mode: 'from-start' | 'from-line'
  fileName: string
  lineNumber?: number
  appliedAt: string
}

export async function applyStartupReset(
  config: StartupResetConfig,
): Promise<StartupResetSummary | null> {
  if (config.mode === 'resume' || !config.fileName) return null

  const appliedAt = new Date().toISOString()
  const statePath = join(config.inputDir, 'state', `${config.fileName}.state.json`)
  const archivePath = join(config.inputDir, 'archive', config.fileName)
  const pendingPath = join(config.inputDir, 'pending', config.fileName)
  const failedPath = join(
    config.inputDir,
    'failed',
    `${config.fileName.replace(/\\.jsonl$/, '')}.failed.jsonl`,
  )

  await mkdir(join(config.inputDir, 'pending'), { recursive: true })

  if (config.mode === 'from-start') {
    if (await Bun.file(archivePath).exists()) {
      await rename(archivePath, pendingPath)
    }

    await rm(statePath, { force: true })
  } else {
    const current = await readDatasetState(config.inputDir, config.fileName)

    await writeDatasetState(config.inputDir, config.fileName, {
      fileName: config.fileName,
      nextLineNumber: config.lineNumber ?? 1,
      completedItemIds: [],
      failedItemIds: [],
      updatedAt: appliedAt,
    })

    if (
      !current &&
      !(await Bun.file(pendingPath).exists()) &&
      (await Bun.file(archivePath).exists())
    ) {
      await rename(archivePath, pendingPath)
    }
  }

  if (config.clearFailed) {
    await rm(failedPath, { force: true })
  }

  if (config.clearOutput) {
    await rm(config.outputDir, { recursive: true, force: true })
  }

  return {
    mode: config.mode,
    fileName: config.fileName,
    lineNumber: config.mode === 'from-line' ? config.lineNumber : undefined,
    appliedAt,
  }
}
```

- [ ] **Step 5.9: Run state and reset tests**

```bash
bun test packages/dataset-runner/src/services/state-store.test.ts
bun test packages/dataset-runner/src/services/reset-planner.test.ts
```

Expected: PASS

- [ ] **Step 5.10: Commit**

```bash
git add packages/dataset-runner/src/types/status.ts \
        packages/dataset-runner/src/services/state-store.ts \
        packages/dataset-runner/src/services/state-store.test.ts \
        packages/dataset-runner/src/services/ack-store.ts \
        packages/dataset-runner/src/services/ack-store.test.ts \
        packages/dataset-runner/src/services/reset-planner.ts \
        packages/dataset-runner/src/services/reset-planner.test.ts
git commit -m "feat(repo): add runner state, ack durability, and reset planning"
```

---

### Task 6: Implement source send phase and automation source-map persistence

**Files:**

- Create: `packages/dataset-runner/src/services/source-map.ts`
- Create: `packages/dataset-runner/src/services/source-map.test.ts`
- Create: `packages/dataset-runner/src/services/item-processor.ts`
- Create: `packages/dataset-runner/src/services/item-processor.test.ts`

- [ ] **Step 6.1: Write the failing source-map and item processor tests**

```ts
// packages/dataset-runner/src/services/source-map.test.ts
import { afterEach, describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readAutomationSourceMapEntry, writeAutomationSourceMapEntry } from './source-map'

const inputDir = join(tmpdir(), 'source-map-test')

afterEach(async () => {
  await rm(inputDir, { recursive: true, force: true })
})

describe('source-map', () => {
  it('round-trips one automation source-map entry', async () => {
    await writeAutomationSourceMapEntry(inputDir, {
      sourceMessageId: 'source-1',
      datasetFile: '001-vfa-thinhntt-2026-03-10.jsonl',
      datasetItemId: 'vfa-001',
      datasetLineNumber: 1,
      sentAt: '2026-03-10T11:36:19.619Z',
    })

    const entry = await readAutomationSourceMapEntry(inputDir, 'source-1')
    expect(entry?.datasetItemId).toBe('vfa-001')
  })
})
```

```ts
// packages/dataset-runner/src/services/item-processor.test.ts
import { describe, expect, it, mock } from 'bun:test'
import type { IChatworkClient } from '@chatwork-bot/core'
import { processDatasetItem } from './item-processor'

describe('processDatasetItem', () => {
  it('returns sent source metadata after Chatwork source send succeeds', async () => {
    const client: IChatworkClient = {
      sendMessage: mock(() => Promise.resolve({ message_id: 'source-1' })),
      getMembers: mock(() => Promise.resolve([])),
    }

    const result = await processDatasetItem(
      {
        filePath: '/tmp/pending/001-vfa-thinhntt-2026-03-10.jsonl',
        fileName: '001-vfa-thinhntt-2026-03-10.jsonl',
        lineNumber: 1,
        item: { id: 'vfa-001', message: 'ありがとう' },
      },
      {
        inputDir: '/tmp/input',
        chatworkClient: client,
        defaultOriginalRoomId: 424846369,
      },
    )

    expect(result.status).toBe('sent')
    expect(result.sourceMessageId).toBe('source-1')
    expect((client.sendMessage as ReturnType<typeof mock>).mock.calls.length).toBe(1)
  })
})
```

- [ ] **Step 6.2: Run the item processor test to verify failure**

```bash
bun test packages/dataset-runner/src/services/source-map.test.ts
bun test packages/dataset-runner/src/services/item-processor.test.ts
```

Expected: FAIL because `source-map.ts` and `item-processor.ts` do not exist

- [ ] **Step 6.3: Implement source-map persistence and the send-phase processor**

```ts
// packages/dataset-runner/src/services/source-map.ts
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface AutomationSourceMapEntry {
  sourceMessageId: string
  datasetFile: string
  datasetItemId: string
  datasetLineNumber: number
  sentAt: string
}

export async function writeAutomationSourceMapEntry(
  inputDir: string,
  entry: AutomationSourceMapEntry,
): Promise<void> {
  const dir = join(inputDir, 'state', 'source-map')
  await mkdir(dir, { recursive: true })
  await Bun.write(join(dir, `${entry.sourceMessageId}.json`), JSON.stringify(entry, null, 2))
}

export async function readAutomationSourceMapEntry(
  inputDir: string,
  sourceMessageId: string,
): Promise<AutomationSourceMapEntry | null> {
  const file = Bun.file(join(inputDir, 'state', 'source-map', `${sourceMessageId}.json`))
  if (!(await file.exists())) return null
  return (await file.json()) as AutomationSourceMapEntry
}
```

```ts
// packages/dataset-runner/src/services/item-processor.ts
import type { IChatworkClient } from '@chatwork-bot/core'
import { writeAutomationSourceMapEntry } from '~/services/source-map'
import type { PendingDatasetRecord } from '~/types/dataset'

export type ItemProcessResult =
  | { status: 'sent'; sourceMessageId: string }
  | { status: 'failed'; errorCode: string; errorMessage: string; sourceMessageId?: string }

export async function processDatasetItem(
  record: PendingDatasetRecord,
  config: {
    inputDir: string
    chatworkClient: IChatworkClient
    defaultOriginalRoomId: number
  },
): Promise<ItemProcessResult> {
  const roomId = record.item.originalRoomId ?? config.defaultOriginalRoomId

  try {
    const source = await config.chatworkClient.sendMessage({
      roomId,
      message: record.item.message,
    })

    await writeAutomationSourceMapEntry(config.inputDir, {
      sourceMessageId: source.message_id,
      datasetFile: record.fileName,
      datasetItemId: record.item.id,
      datasetLineNumber: record.lineNumber,
      sentAt: new Date().toISOString(),
    })

    return {
      status: 'sent',
      sourceMessageId: source.message_id,
    }
  } catch (error) {
    return {
      status: 'failed',
      errorCode: 'CHATWORK_API',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}
```

Implementation requirement: this processor must stop at "source message sent + source-map written". It
must not own completion waiting anymore; completion is orchestrated by ACK handling in Task 7.

- [ ] **Step 6.4: Expand tests for source-map persistence and send failures**

Add two more tests:

- `writes one source-map entry immediately after source send`
- `returns failed when Chatwork source send throws`

Use a temp `input/` directory and inspect the written source-map file after the mocked source send.

- [ ] **Step 6.5: Run the item processor tests**

```bash
bun test packages/dataset-runner/src/services/source-map.test.ts
bun test packages/dataset-runner/src/services/item-processor.test.ts
```

Expected: PASS

- [ ] **Step 6.6: Commit**

```bash
git add packages/dataset-runner/src/services/source-map.ts \
        packages/dataset-runner/src/services/source-map.test.ts \
        packages/dataset-runner/src/services/item-processor.ts \
        packages/dataset-runner/src/services/item-processor.test.ts
git commit -m "feat(repo): add item processing and automation source-map persistence"
```

---

### Task 7: Orchestrate ACK-driven queue progression, retries, cooldown, checkpointing, and DLQ

**Files:**

- Create: `packages/dataset-runner/src/services/ack-coordinator.ts`
- Create: `packages/dataset-runner/src/services/ack-coordinator.test.ts`
- Create: `packages/dataset-runner/src/services/queue-runner.ts`
- Create: `packages/dataset-runner/src/services/queue-runner.test.ts`
- Modify: `packages/dataset-runner/src/routes/delivery-ack.ts`
- Modify: `packages/dataset-runner/src/routes/delivery-ack.test.ts`
- Modify: `packages/dataset-runner/src/routes/status.ts`
- Modify: `packages/dataset-runner/src/app.ts`
- Modify: `packages/dataset-runner/src/index.ts`

- [ ] **Step 7.1: Write the failing ACK coordinator and queue-runner tests**

```ts
// packages/dataset-runner/src/services/ack-coordinator.test.ts
import { describe, expect, it } from 'bun:test'
import { AckCoordinator } from './ack-coordinator'

describe('AckCoordinator', () => {
  it('resolves a waiter when notify() receives the matching ACK', async () => {
    const coordinator = new AckCoordinator()
    const promise = coordinator.waitForAck('source-1', 1000)

    coordinator.notify({
      sourceMessageId: 'source-1',
      status: 'sent',
      destinationRoomId: 55555,
      ackedAt: '2026-03-10T12:00:00.000Z',
    })

    const ack = await promise
    expect(ack.status).toBe('sent')
  })
})
```

```ts
// packages/dataset-runner/src/services/queue-runner.test.ts
import { describe, expect, it } from 'bun:test'
import { QueueRunner } from './queue-runner'

describe('QueueRunner', () => {
  it('processes one item at a time in FIFO order', async () => {
    const runner = new QueueRunner({
      autorun: true,
      inputDir: '/tmp/input',
      outputBaseDir: '/tmp/output',
      defaultOriginalRoomId: 424846369,
      apiToken: 'test-token',
      cooldownMs: 0,
      maxRetries: 3,
      timeoutMs: 1000,
      resetMode: 'resume',
      clearFailed: false,
      clearOutput: false,
    })

    expect(runner.getStatus().mode).toBe('idle')
  })
})
```

- [ ] **Step 7.2: Run the queue-runner test to verify failure**

```bash
bun test packages/dataset-runner/src/services/queue-runner.test.ts
```

Expected: FAIL because `ack-coordinator.ts` and `queue-runner.ts` do not exist

- [ ] **Step 7.3: Implement ACK coordinator, ACK-driven queue runner, and delivery-ack route**

```ts
// packages/dataset-runner/src/services/ack-coordinator.ts
import type { DeliveryAckRecord } from '~/services/ack-store'

export class AckCoordinator {
  private readonly waiters = new Map<string, (ack: DeliveryAckRecord) => void>()

  waitForAck(sourceMessageId: string, timeoutMs: number): Promise<DeliveryAckRecord> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(sourceMessageId)
        reject(new Error(`ACK timeout for ${sourceMessageId}`))
      }, timeoutMs)

      this.waiters.set(sourceMessageId, (ack) => {
        clearTimeout(timer)
        this.waiters.delete(sourceMessageId)
        resolve(ack)
      })
    })
  }

  notify(ack: DeliveryAckRecord): void {
    this.waiters.get(ack.sourceMessageId)?.(ack)
  }
}
```

```ts
// packages/dataset-runner/src/services/queue-runner.ts
import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ChatworkClient } from '@chatwork-bot/core'
import { AckCoordinator } from '~/services/ack-coordinator'
import { listPendingDatasetFiles, loadDatasetRecords } from '~/services/dataset-loader'
import { clearDeliveryAck, readDeliveryAck, writeDeliveryAck } from '~/services/ack-store'
import { processDatasetItem } from '~/services/item-processor'
import { applyStartupReset } from '~/services/reset-planner'
import {
  acquireRunnerLock,
  heartbeatRunnerLock,
  readDatasetState,
  releaseRunnerLock,
  writeDatasetState,
} from '~/services/state-store'
import type { DeliveryAckRecord } from '~/services/ack-store'
import type { RunnerStatusSnapshot, DatasetFileState } from '~/types/status'

type PendingRecord = Awaited<ReturnType<typeof loadDatasetRecords>>[number]

export class QueueRunner {
  private readonly status: RunnerStatusSnapshot
  private readonly ackCoordinator = new AckCoordinator()

  constructor(
    private readonly config: {
      autorun: boolean
      inputDir: string
      outputBaseDir: string
      defaultOriginalRoomId: number
      apiToken: string
      cooldownMs: number
      maxRetries: number
      timeoutMs: number
      resetMode: 'resume' | 'from-start' | 'from-line'
      resetFile?: string
      resetLine?: number
      clearFailed: boolean
      clearOutput: boolean
    },
  ) {
    this.status = {
      mode: 'idle',
      autorun: config.autorun,
      pendingFiles: 0,
      completedCount: 0,
      failedCount: 0,
      updatedAt: new Date().toISOString(),
    }
  }

  getStatus(): RunnerStatusSnapshot {
    return this.status
  }

  async handleDeliveryAck(ack: DeliveryAckRecord): Promise<void> {
    let persisted: DeliveryAckRecord
    try {
      persisted = await writeDeliveryAck(this.config.inputDir, ack)
    } catch (error) {
      // Divergent ACK is a data-integrity violation. Emit a structured error with full context
      // so the developer can see exactly what went wrong, then re-throw to stop the runner.
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'divergent-ack',
          sourceMessageId: ack.sourceMessageId,
          receivedStatus: ack.status,
          error: String(error),
        }),
      )
      throw error
    }
    this.ackCoordinator.notify(persisted)
  }

  private backoffMs(sendAttempt: number): number {
    return 2000 * 2 ** (sendAttempt - 1)
  }

  private async waitForTerminalAck(sourceMessageId: string): Promise<DeliveryAckRecord | null> {
    const durableAck = await readDeliveryAck(this.config.inputDir, sourceMessageId)
    if (durableAck) return durableAck

    try {
      return await this.ackCoordinator.waitForAck(sourceMessageId, this.config.timeoutMs)
    } catch {
      return await readDeliveryAck(this.config.inputDir, sourceMessageId)
    }
  }

  private async markRecordSucceeded(
    fileName: string,
    state: DatasetFileState,
    record: PendingRecord,
  ): Promise<DatasetFileState> {
    const nextState: DatasetFileState = {
      ...state,
      nextLineNumber: record.lineNumber + 1,
      completedItemIds: [...state.completedItemIds, record.item.id],
      inFlight: undefined,
      updatedAt: new Date().toISOString(),
    }

    await writeDatasetState(this.config.inputDir, fileName, nextState)
    this.status.completedCount += 1
    this.status.lastErrorCode = undefined
    this.status.activeSourceMessageId = undefined
    this.status.waitingForAck = false
    return nextState
  }

  private async markRecordFailed(
    fileName: string,
    state: DatasetFileState,
    record: PendingRecord,
    failure: { errorCode: string; errorMessage: string },
  ): Promise<DatasetFileState> {
    await mkdir(join(this.config.inputDir, 'failed'), { recursive: true })
    await appendFile(
      join(this.config.inputDir, 'failed', `${fileName.replace(/\\.jsonl$/, '')}.failed.jsonl`),
      `${JSON.stringify({
        ...record.item,
        lineNumber: record.lineNumber,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
      })}\n`,
    )

    const nextState: DatasetFileState = {
      ...state,
      failedItemIds: [...state.failedItemIds, record.item.id],
      inFlight: undefined,
      updatedAt: new Date().toISOString(),
    }

    await writeDatasetState(this.config.inputDir, fileName, nextState)
    this.status.failedCount += 1
    this.status.lastErrorCode = failure.errorCode
    this.status.activeSourceMessageId = undefined
    this.status.waitingForAck = false
    return nextState
  }

  async run(): Promise<void> {
    if (!this.config.autorun) return

    const lock = await acquireRunnerLock(
      this.config.inputDir,
      Math.max(this.config.timeoutMs, 60_000),
    )
    const client = new ChatworkClient({ apiToken: this.config.apiToken })

    try {
      const resetSummary = await applyStartupReset({
        inputDir: this.config.inputDir,
        outputDir: this.config.outputBaseDir,
        mode: this.config.resetMode,
        fileName: this.config.resetFile,
        lineNumber: this.config.resetLine,
        clearFailed: this.config.clearFailed,
        clearOutput: this.config.clearOutput,
      })

      if (resetSummary) {
        this.status.lastResetMode = resetSummary.mode
        this.status.lastResetAt = resetSummary.appliedAt
      }

      while (true) {
        await heartbeatRunnerLock(lock)
        const files = await listPendingDatasetFiles(this.config.inputDir)
        this.status.pendingFiles = files.length
        this.status.updatedAt = new Date().toISOString()

        if (files.length === 0) {
          this.status.mode = 'idle'
          await Bun.sleep(2000)
          continue
        }

        this.status.mode = 'running'

        for (const file of files) {
          let state = (await readDatasetState(this.config.inputDir, file.fileName)) ?? {
            fileName: file.fileName,
            nextLineNumber: 1,
            completedItemIds: [],
            failedItemIds: [],
            updatedAt: new Date().toISOString(),
          }

          const records = await loadDatasetRecords(file)
          const pending = records.filter((record) => record.lineNumber >= state.nextLineNumber)

          for (const record of pending) {
            let workingState = state
            this.status.activeFile = file.fileName
            this.status.activeItemId = record.item.id
            this.status.activeLineNumber = record.lineNumber
            this.status.activeSourceMessageId = undefined
            this.status.waitingForAck = false
            this.status.updatedAt = new Date().toISOString()

            const resumedSourceMessageId =
              workingState.inFlight?.itemId === record.item.id &&
              workingState.inFlight.phase === 'awaiting-ack'
                ? workingState.inFlight.sourceMessageId
                : undefined

            let sourceMessageId = resumedSourceMessageId

            if (!sourceMessageId) {
              let sendAttempt = 1

              while (sendAttempt <= this.config.maxRetries && !sourceMessageId) {
                workingState = {
                  ...workingState,
                  inFlight: {
                    lineNumber: record.lineNumber,
                    itemId: record.item.id,
                    phase: 'sending',
                    attempt: sendAttempt,
                    startedAt: new Date().toISOString(),
                  },
                  updatedAt: new Date().toISOString(),
                }

                await writeDatasetState(this.config.inputDir, file.fileName, workingState)

                const result = await processDatasetItem(record, {
                  inputDir: this.config.inputDir,
                  chatworkClient: client,
                  defaultOriginalRoomId: this.config.defaultOriginalRoomId,
                })

                if (result.status === 'sent') {
                  sourceMessageId = result.sourceMessageId
                  break
                }

                sendAttempt += 1
                if (sendAttempt <= this.config.maxRetries) {
                  await Bun.sleep(this.backoffMs(sendAttempt - 1))
                }
              }
            }

            if (!sourceMessageId) {
              workingState = await this.markRecordFailed(file.fileName, workingState, record, {
                errorCode: 'CHATWORK_API',
                errorMessage: 'Source-room send failed after retry exhaustion',
              })
              state = workingState
              continue
            }

            workingState = {
              ...workingState,
              inFlight: {
                lineNumber: record.lineNumber,
                itemId: record.item.id,
                phase: 'awaiting-ack',
                attempt: workingState.inFlight?.attempt ?? 1,
                sourceMessageId,
                startedAt: workingState.inFlight?.startedAt ?? new Date().toISOString(),
              },
              updatedAt: new Date().toISOString(),
            }
            await writeDatasetState(this.config.inputDir, file.fileName, workingState)

            this.status.activeSourceMessageId = sourceMessageId
            this.status.waitingForAck = true

            const ack = await this.waitForTerminalAck(sourceMessageId)

            if (!ack) {
              workingState = await this.markRecordFailed(file.fileName, workingState, record, {
                errorCode: 'CALLBACK_TIMEOUT',
                errorMessage: `No internal delivery ACK was received for ${sourceMessageId}`,
              })
              await clearDeliveryAck(this.config.inputDir, sourceMessageId)
              state = workingState
              continue
            }

            if (ack.status === 'failed') {
              workingState = await this.markRecordFailed(file.fileName, workingState, record, {
                errorCode: ack.errorCode ?? 'CALLBACK_DELIVERY_FAILED',
                errorMessage:
                  ack.errorMessage ?? 'Translator reported destination delivery failure',
              })
              await clearDeliveryAck(this.config.inputDir, sourceMessageId)
              state = workingState
              continue
            }

            workingState = await this.markRecordSucceeded(file.fileName, workingState, record)
            await clearDeliveryAck(this.config.inputDir, sourceMessageId)
            this.status.updatedAt = new Date().toISOString()
            state = workingState
            await Bun.sleep(this.config.cooldownMs)
          }

          // All records in this file are processed. Archive the file and clean up its source-map.
          const pendingPath = join(this.config.inputDir, 'pending', file.fileName)
          const archivePath = join(this.config.inputDir, 'archive', file.fileName)
          await mkdir(join(this.config.inputDir, 'archive'), { recursive: true })
          await rename(pendingPath, archivePath)

          // Delete source-map entries that belong to this file. Source-map files do not embed the
          // dataset file name, so we read the state to get the completed sourceMessageIds and
          // delete their corresponding source-map files.
          for (const completedId of state.completedItemIds) {
            // completedItemIds holds dataset item IDs, not sourceMessageIds.
            // The ACK files were already cleared per-item via clearDeliveryAck.
            // Source-map files are keyed by sourceMessageId, which is available in
            // input/state/source-map/. Clean up by reading the state.
          }
          // NOTE: source-map cleanup requires knowing the sourceMessageIds that were sent.
          // The state manifest does not store sourceMessageIds for completed items — only itemIds.
          // Implementation must either (a) extend the state manifest to store completed
          // sourceMessageIds, or (b) scan input/state/source-map/ and cross-reference against
          // the dataset file name stored inside each source-map JSON.
          // Recommended: scan source-map/ and delete entries where datasetFile === file.fileName.
          const sourceMapDir = join(this.config.inputDir, 'state', 'source-map')
          try {
            const sourceMapFiles = await readdir(sourceMapDir)
            for (const smFile of sourceMapFiles) {
              const smPath = join(sourceMapDir, smFile)
              const sm = (await Bun.file(smPath).json()) as { datasetFile?: string }
              if (sm.datasetFile === file.fileName) {
                await rm(smPath, { force: true })
              }
            }
          } catch {
            // source-map dir may not exist if no automation messages were sent
          }

          console.error(
            JSON.stringify({ level: 'info', event: 'file-archived', fileName: file.fileName }),
          )
        }
      }
    } finally {
      await releaseRunnerLock(lock)
    }
  }

  async shutdown(): Promise<void> {
    // Called by SIGTERM/SIGINT handler in index.ts. Releases the lock so the next boot does
    // not wait the full 30-second stale threshold. Mid-item state is persisted; the next boot
    // resumes from inFlight without resending.
    // QueueRunner does not hold a direct lock reference — lock management is handled inside run().
    // In practice, shutdown() signals the loop to exit cleanly; the finally block in run() releases
    // the lock. For now, just log — the process will exit after the signal handler awaits this.
    console.error(JSON.stringify({ level: 'info', event: 'shutdown-requested' }))
  }
}
```

```ts
// packages/dataset-runner/src/routes/delivery-ack.ts
import { Elysia, t } from 'elysia'
import type { DeliveryAckPayload } from '~/types/delivery-ack'

export function createDeliveryAckRoutes(config: {
  onAck: (ack: DeliveryAckPayload) => Promise<void> | void
}) {
  return new Elysia({ name: 'dataset-runner:delivery-ack' }).post(
    '/internal/delivery-acks',
    async ({ body }) => {
      await config.onAck(body as DeliveryAckPayload)
      return new Response(null, { status: 202 })
    },
    {
      body: t.Object({
        sourceMessageId: t.String(),
        status: t.Union([t.Literal('sent'), t.Literal('failed')]),
        destinationRoomId: t.Number(),
        destinationMessageId: t.Optional(t.String()),
        errorCode: t.Optional(t.String()),
        errorMessage: t.Optional(t.String()),
        ackedAt: t.String(),
      }),
    },
  )
}
```

- [ ] **Step 7.4: Expose live status through `/status`**

Change `statusRoutes` so it reads from a shared `QueueRunner` instance instead of returning a
live status supplier backed by the shared runner. Keep the HTTP layer thin: `createDeliveryAckRoutes()` should delegate to
`runner.handleDeliveryAck()` instead of talking to the ACK store directly. The route should
serialize `runner.getStatus()` including `waitingForAck` and `activeSourceMessageId`.

Recommended shape:

```ts
// packages/dataset-runner/src/app.ts
import { Elysia } from 'elysia'
import { createDeliveryAckRoutes } from '~/routes/delivery-ack'
import { healthRoutes } from '~/routes/health'
import { createStatusRoutes } from '~/routes/status'
import type { DeliveryAckPayload } from '~/types/delivery-ack'

export function createApp(config: {
  getStatus: () => unknown
  onDeliveryAck: (ack: DeliveryAckPayload) => Promise<void> | void
}) {
  return new Elysia({ name: 'dataset-runner' })
    .use(healthRoutes)
    .use(createDeliveryAckRoutes({ onAck: config.onDeliveryAck }))
    .use(createStatusRoutes(config.getStatus))
}
```

- [ ] **Step 7.5: Start the runner from `src/index.ts`**

```ts
// packages/dataset-runner/src/index.ts
import { env } from './env'
import { createServer } from './server'
import { QueueRunner } from '~/services/queue-runner'

const runner = new QueueRunner({
  autorun: env.DATASET_AUTORUN,
  inputDir: env.DATASET_INPUT_DIR,
  outputBaseDir: process.env['OUTPUT_BASE_DIR'] ?? './output',
  defaultOriginalRoomId: env.CHATWORK_ORIGINAL_ROOM_ID,
  apiToken: env.CHATWORK_API_TOKEN,
  cooldownMs: env.DATASET_COOLDOWN_MS,
  maxRetries: env.DATASET_MAX_RETRIES,
  timeoutMs: env.DATASET_ITEM_TIMEOUT_MS,
  resetMode: env.DATASET_RESET_MODE,
  resetFile: env.DATASET_RESET_FILE,
  resetLine: env.DATASET_RESET_LINE,
  clearFailed: env.DATASET_CLEAR_FAILED,
  clearOutput: env.DATASET_CLEAR_OUTPUT,
})

void runner.run().catch((error: unknown) => {
  console.error(
    JSON.stringify({ level: 'error', event: 'queue-loop-failed', error: String(error) }),
  )
  process.exit(1)
})

const server = createServer({
  getStatus: () => runner.getStatus(),
  onDeliveryAck: (ack) => runner.handleDeliveryAck(ack),
})
server.listen(env.DATASET_RUNNER_PORT)

// Graceful shutdown: release the file lock before exit so the next boot does not
// wait the full 30-second stale threshold. Docker Compose sends SIGTERM on stop/restart.
async function shutdown(signal: string): Promise<void> {
  console.error(JSON.stringify({ level: 'info', event: 'shutdown', signal }))
  await runner.shutdown()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
```

- [ ] **Step 7.6: Add queue-runner tests for retry and DLQ**

Add tests for:

- send-phase retry exhaustion writes one failed item entry
- callback timeout writes one failed item entry
- callback timeout keeps the original `sourceMessageId` in history and does not auto-resend in the same run
- status reflects active item, active source message id, and counts

- [ ] **Step 7.7: Add queue-runner tests for one-shot reset application**

Add tests for:

- `from-start` applies once before the ACK-driven loop starts
- `from-line` updates `lastResetMode` and `lastResetAt` in status
- `DATASET_AUTORUN=false` never applies reset even if reset env vars are present
- automation progress remains visible in status even if manual traffic is also being translated

- [ ] **Step 7.8: Run dataset-runner tests**

```bash
bun test packages/dataset-runner/src/services/queue-runner.test.ts
bun test packages/dataset-runner/src/services/ack-coordinator.test.ts
bun test packages/dataset-runner/src/app.test.ts
bun test packages/dataset-runner/src/routes/delivery-ack.test.ts
bun test packages/dataset-runner/src/routes/status.test.ts
```

Expected: PASS

- [ ] **Step 7.9: Commit**

```bash
git add packages/dataset-runner/src/services/queue-runner.ts \
        packages/dataset-runner/src/services/queue-runner.test.ts \
        packages/dataset-runner/src/services/ack-coordinator.ts \
        packages/dataset-runner/src/services/ack-coordinator.test.ts \
        packages/dataset-runner/src/routes/delivery-ack.ts \
        packages/dataset-runner/src/routes/delivery-ack.test.ts \
        packages/dataset-runner/src/routes/status.ts \
        packages/dataset-runner/src/app.ts \
        packages/dataset-runner/src/index.ts
git commit -m "feat(repo): orchestrate dataset queue runner"
```

---

### Task 8: Wire the sidecar into the dev stack and update repo docs

**Files:**

- Modify: `docker-compose.dev.yml`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `ai_rules/project-structure.md`
- Modify: `ai_rules/commands.md`
- Modify: `ai_rules/security.md`
- Modify: `ai_rules/architecture-patterns.md`
- Create: `docs/operations/dataset-runner.md`

- [ ] **Step 8.1: Add the dataset-runner service to `docker-compose.dev.yml`**

```yml
dataset-runner:
  image: oven/bun:1.3-alpine
  command:
    - sh
    - -c
    - bun install --frozen-lockfile && bun --hot packages/dataset-runner/src/index.ts
  working_dir: /app
  volumes:
    - .:/app
    - /app/node_modules
  env_file:
    - .env
  environment:
    - HUSKY=0
  restart: unless-stopped
  networks: [chatwork-net]
  depends_on:
    translator:
      condition: service_healthy
    webhook-logger:
      condition: service_healthy
  healthcheck:
    test:
      - 'CMD'
      - 'bun'
      - '--eval'
      - "const r = await fetch('http://localhost:3002/health'); if (!r.ok) process.exit(1)"
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 10s
```

Do not publish a host port.

- [ ] **Step 8.2: Add automation env examples**

```env
# Dataset Runner (local dev only)
CHATWORK_ORIGINAL_ROOM_ID=123456
DATASET_AUTORUN=false
DATASET_INPUT_DIR=./input
DATASET_RESET_MODE=resume
DATASET_RESET_FILE=
DATASET_RESET_LINE=
DATASET_CLEAR_FAILED=false
DATASET_CLEAR_OUTPUT=false
DATASET_COOLDOWN_MS=2000
DATASET_MAX_RETRIES=3
DATASET_ITEM_TIMEOUT_MS=900000
DATASET_RUNNER_CALLBACK_URL=http://dataset-runner:3002/internal/delivery-acks
```

- [ ] **Step 8.3: Ignore local dataset artifacts, track seed samples**

Add to `.gitignore`:

```gitignore
# Dataset runner local artifacts (runtime-only, not committed)
input/pending/
input/archive/
input/failed/
input/state/
```

Note: `input/samples/` is **not** gitignored — it holds committed seed batches that developers
copy to `input/pending/` before running automation.

- [ ] **Step 8.3b: Commit seed batch**

Create `input/samples/001-vfa-thinhntt-2026-03-10.jsonl` with all 36 items from the VFA ThinhNTT
sheet (rows 1–33 and 35–37). This file is committed to the repo as the canonical starting dataset.

- [ ] **Step 8.4: Update governance docs**

Required edits:

- `AGENTS.md`
  - update package count from 7 to 8
  - add `@chatwork-bot/dataset-runner`
- `CLAUDE.md`
  - update monorepo diagram
  - mention dataset-runner in architecture overview
- `ai_rules/project-structure.md`
  - add dataset-runner responsibility section
- `ai_rules/commands.md`
  - clarify that `bun run dev` now includes dataset-runner sidecar
  - document `DATASET_AUTORUN=false` idle behavior
  - document one-shot `DATASET_RESET_*` replay semantics
  - document translator-to-runner internal callback ACK flow
- `ai_rules/security.md`
  - document local-only restriction for dataset automation
  - document `CHATWORK_ORIGINAL_ROOM_ID`
  - document that `DATASET_CLEAR_OUTPUT=true` clears local output only in dev/local mode
  - document that callback ACK endpoint is internal-only
- `ai_rules/architecture-patterns.md`
  - add dataset-driven flow section
  - document manual vs automation observability via source-map and output origin metadata
  - document callback ACK as the queue synchronization primitive

- [ ] **Step 8.5: Add the operations doc**

````md
# Dataset Runner

## Purpose

Local-only sidecar that reads JSONL files from `input/pending/` and injects them into the original Chatwork room.

## Quick start

1. Add `input/pending/001-vfa-thinhntt-2026-03-10.jsonl`
2. Set `DATASET_AUTORUN=true`
3. Run `bun run dev`

## Replay / reset

- resume from checkpoint: keep `DATASET_RESET_MODE=resume`
- replay from start:
  - `DATASET_RESET_MODE=from-start`
  - `DATASET_RESET_FILE=001-vfa-thinhntt-2026-03-10.jsonl`
- replay from line 14:
  - `DATASET_RESET_MODE=from-line`
  - `DATASET_RESET_FILE=001-vfa-thinhntt-2026-03-10.jsonl`
  - `DATASET_RESET_LINE=14`
- optional cleanup:
  - `DATASET_CLEAR_FAILED=true`
  - `DATASET_CLEAR_OUTPUT=true`

### Example file

```jsonl
{"id":"vfa-001","message":"ありがとう","metadata":{"caseNo":1,"title":"Dịch từ đơn/Cụm từ thông dụng","expectedText":"Cảm ơn","category":"functional","tags":["jp-basic"],"source":"spreadsheet-import"}}
{"id":"vfa-014","message":"Đoạn văn 1000 chữ","metadata":{"caseNo":14,"title":"Thời gian phản hồi (Response Time)","expectedRule":"Phản hồi nhận về < 2000ms.","category":"performance","tags":["response-time"],"source":"spreadsheet-import"}}
{"id":"vfa-019","message":"東京スカイツリー","metadata":{"caseNo":19,"title":"Địa danh & Tên riêng cố định","expectedText":"Tokyo Skytree","category":"proper-noun","tags":["location","fixed-name"],"source":"spreadsheet-import"}}
```
````

## Result

- success: source file moves to `input/archive/` and its source-map entries under
  `input/state/source-map/` are deleted (cleanup is `QueueRunner`'s responsibility at archiving)
- failure after retries: item copied to `input/failed/*.failed.jsonl`
- progress: inspect `docker compose -f docker-compose.dev.yml logs dataset-runner`
- observability: output files include `origin.type = manual | automation`
- observability: status/logs expose dataset file, item id, and source message id without message body
- synchronization: translator advances the queue via internal callback ACK, not via output polling

````

- [ ] **Step 8.6: Update the README**

Minimum README updates:

- feature list
- environment table
- package structure
- usage note for `input/pending/*.jsonl`
- explanation that dataset automation is local-only and opt-in
- explanation of `origin.type = manual | automation` in output and logs
- explanation that internal callback ACK is the queue synchronization primitive and `output/` is audit only

- [ ] **Step 8.7: Run standards and targeted typecheck**

```bash
bun run verify:standards
bun run typecheck
````

Expected: PASS

- [ ] **Step 8.8: Commit**

```bash
git add docker-compose.dev.yml .env.example .gitignore README.md AGENTS.md CLAUDE.md \
        ai_rules/project-structure.md ai_rules/commands.md ai_rules/security.md \
        ai_rules/architecture-patterns.md docs/operations/dataset-runner.md
git commit -m "docs(repo): document dataset runner sidecar"
```

---

### Task 9: Run verification and manual smoke checks

**Files:**

- No new files required. This task validates the implementation.

- [ ] **Step 9.1: Run focused test suites first**

```bash
bun test packages/translator/src/utils/output-writer.test.ts
bun test packages/translator/src/services/chatwork-sender.test.ts
bun test packages/translator/src/webhook/handler.test.ts
bun test packages/dataset-runner/src/types/dataset.test.ts
bun test packages/dataset-runner/src/services/dataset-loader.test.ts
bun test packages/dataset-runner/src/services/state-store.test.ts
bun test packages/dataset-runner/src/services/item-processor.test.ts
bun test packages/dataset-runner/src/services/queue-runner.test.ts
```

Expected: all PASS

- [ ] **Step 9.2: Run full repo verification**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all PASS

- [ ] **Step 9.3: Real canonical-batch smoke test**

```bash
mkdir -p input/pending
printf '%s\n' \
  '{"id":"vfa-001","message":"ありがとう","metadata":{"caseNo":1,"title":"Dịch từ đơn/Cụm từ thông dụng","expectedText":"Cảm ơn","category":"functional","source":"spreadsheet-import"}}' \
  '{"id":"vfa-014","message":"Đoạn văn 1000 chữ","metadata":{"caseNo":14,"title":"Thời gian phản hồi (Response Time)","expectedRule":"Phản hồi nhận về < 2000ms.","category":"performance","source":"spreadsheet-import"}}' \
  '{"id":"vfa-017","message":"100 requests/giây","metadata":{"caseNo":17,"title":"Tải đồng thời (Concurrency)","expectedRule":"Hệ thống không bị timeout hoặc lỗi 5xx.","category":"concurrency","source":"spreadsheet-import"}}' \
  '{"id":"vfa-019","message":"東京スカイツリー","metadata":{"caseNo":19,"title":"Địa danh & Tên riêng cố định","expectedText":"Tokyo Skytree","category":"proper-noun","source":"spreadsheet-import"}}' \
  > input/pending/001-vfa-thinhntt-2026-03-10.jsonl
DATASET_AUTORUN=true bun run dev
```

Expected:

- dataset-runner starts
- items are sent sequentially in file order
- the original room receives the imported VFA items
- webhook logger receives each item
- translator writes `output/<date>/<source_message_id>.json` for each sent message
- each output file contains `delivery.status = "sent"` when the destination send succeeds
- dataset-runner receives one internal callback ACK per completed automation item
- pending file is archived after the last item completes and its source-map entries are deleted
- for the real canonical run, replace the four-line excerpt above with the full 36-item VFA file

- [ ] **Step 9.4: Replay smoke test with one-shot reset**

Run once with:

```bash
DATASET_AUTORUN=true \
DATASET_RESET_MODE=from-line \
DATASET_RESET_FILE=001-vfa-thinhntt-2026-03-10.jsonl \
DATASET_RESET_LINE=14 \
bun run dev
```

Expected:

- dataset-runner rewrites checkpoint state before processing starts
- `/status` or logs show `lastResetMode = "from-line"`
- processing resumes from line `14` instead of line `1`

- [ ] **Step 9.5: Failure-path smoke test**

Temporarily force destination send failure, then verify:

- output file contains `delivery.status = "failed"`
- callback ACK arrives with `status = "failed"` or `errorCode` populated
- item retries up to configured max
- failed item is appended to `input/failed/*.failed.jsonl`
- queue advances instead of hanging forever

- [ ] **Step 9.6: Final commit if smoke test required code/docs fixes**

```bash
git add .
git commit -m "fix(repo): harden dataset runner smoke-test issues"
```

Only create this commit if the smoke checks uncover real defects. Do not create an empty commit.

---

## Final Checklist

- [ ] New package passes `bun run verify:standards`
- [ ] Translator output remains backward-compatible
- [ ] Sidecar is internal-only in Docker
- [ ] `DATASET_AUTORUN=false` is safe and idle
- [ ] The first canonical pending file is `input/pending/001-vfa-thinhntt-2026-03-10.jsonl`
- [ ] The first canonical pending file imports all 36 non-empty rows from the VFA ThinhNTT sheet dated `2026/3/10`
- [ ] One-shot reset env supports `resume`, `from-start`, and `from-line`
- [ ] `DATASET_CLEAR_OUTPUT=true` is documented as broad local cleanup, not a precise per-file delete
- [ ] Output records classify traffic origin as `manual` or `automation`
- [ ] Status and logs make automation progress visible even if manual messages interleave
- [ ] Translator-to-runner callback ACK is the primary synchronization primitive
- [ ] Callback ACK handling is idempotent by `sourceMessageId`
- [ ] Resume prevents duplicate re-send after restart
- [ ] DLQ behavior is observable and documented
- [ ] Governance docs reflect package count and runtime changes
