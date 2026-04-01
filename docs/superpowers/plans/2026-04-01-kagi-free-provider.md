# Kagi Free Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Kagi FastTranslate as a "Free" provider into the chatwork-translation-bot monorepo — zero breaking changes to existing LLM flows.

**Architecture:** A new `kagi-translator` Docker sidecar (Puppeteer Real Browser) exposes `POST /translate`. The translator package adds a completely separate handler (`handleFreeTranslateRequest`) that reads from a new `FreeRoomConfigStore` and calls the sidecar via `KagiClient`. The dashboard gets isolated "Free Rooms" pages and a new sidebar section.

**Tech Stack:** Bun · TypeScript strict · Elysia · Zod v4 · puppeteer-real-browser · Zustand · React Hook Form · Docker Compose

---

## File Map

### New packages

```
packages/kagi-sidecar/
  package.json
  tsconfig.json
  src/
    index.ts
    server.ts
    browser-service.ts
    url-builder.ts
    url-builder.test.ts

packages/provider-kagi/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    kagi-client.ts
    kagi-client.test.ts
```

### Translator additions (additive only)

```
packages/translator/src/types/free-room-config.ts          NEW
packages/translator/src/services/free-room-config-store.ts NEW
packages/translator/src/services/free-room-config-store.test.ts NEW
packages/translator/src/routes/free-rooms.ts               NEW
packages/translator/src/webhook/free-handler.ts            NEW
packages/translator/src/webhook/free-handler.test.ts       NEW
packages/translator/src/webhook/router.ts                  +2 lines
packages/translator/src/app.ts                             +createFreeRoomsRoutes
packages/translator/src/server.ts                          +freeRoomStore param
packages/translator/src/index.ts                           +FreeRoomConfigStore + KagiClient + initFreeTranslateHandler
packages/translator/src/env-schema.ts                      +KAGI_TRANSLATOR_URL
packages/translator/package.json                           +@chatwork-bot/provider-kagi dep
```

### Dashboard additions (additive only)

```
packages/dashboard/src/lib/free-room-schemas.ts            NEW
packages/dashboard/src/lib/free-room-schemas.test.ts       NEW
packages/dashboard/src/lib/free-room-api.ts                NEW
packages/dashboard/src/stores/free-room-store.ts           NEW
packages/dashboard/src/pages/free-rooms.tsx                NEW
packages/dashboard/src/pages/free-room-create.tsx          NEW
packages/dashboard/src/pages/free-room-detail.tsx          NEW
packages/dashboard/src/layouts/app-layout.tsx              +Free section in navItems
packages/dashboard/src/router.tsx                          +3 free routes
```

### Infrastructure

```
Dockerfile.kagi                NEW
docker-compose.yml             +kagi-translator service
docker-compose.dev.yml         +kagi-translator service
```

---

## Task 1: kagi-sidecar — package scaffold + url-builder

**Files:**

- Create: `packages/kagi-sidecar/package.json`
- Create: `packages/kagi-sidecar/tsconfig.json`
- Create: `packages/kagi-sidecar/src/url-builder.ts`
- Test: `packages/kagi-sidecar/src/url-builder.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/kagi-sidecar/src/url-builder.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
import { buildKagiUrl } from './url-builder'

describe('buildKagiUrl', () => {
  it('Clear — base params only, no extra params', () => {
    const url = buildKagiUrl('Hello', 'Clear')
    expect(url).toContain('from=auto')
    expect(url).toContain('to=vi')
    expect(url).toContain('text=Hello')
    expect(url).not.toContain('language_complexity')
    expect(url).not.toContain('formality')
    expect(url).not.toContain('style=literal')
  })

  it('Wild — vi_casual + c2, no style=literal', () => {
    const url = buildKagiUrl('Hello', 'Wild')
    expect(url).toContain('language_complexity=c2')
    expect(url).toContain('formality=more')
    expect(url).toContain('formality_context=vi_casual')
    expect(url).not.toContain('style=literal')
  })

  it('Easy — vi_casual + b2', () => {
    const url = buildKagiUrl('Hello', 'Easy')
    expect(url).toContain('language_complexity=b2')
    expect(url).toContain('formality_context=vi_casual')
  })

  it('Smart — vi_formal + b2', () => {
    const url = buildKagiUrl('Hello', 'Smart')
    expect(url).toContain('language_complexity=b2')
    expect(url).toContain('formality_context=vi_formal')
  })

  it('Fine — vi_formal + c1', () => {
    const url = buildKagiUrl('Hello', 'Fine')
    expect(url).toContain('language_complexity=c1')
    expect(url).toContain('formality_context=vi_formal')
  })

  it('True — style=literal + b2, no formality', () => {
    const url = buildKagiUrl('Hello', 'True')
    expect(url).toContain('style=literal')
    expect(url).toContain('language_complexity=b2')
    expect(url).not.toContain('formality')
  })

  it('appends context when provided', () => {
    const url = buildKagiUrl('Hello', 'Clear', 'software team')
    expect(url).toContain('context=')
  })

  it('omits context when undefined', () => {
    expect(buildKagiUrl('Hello', 'Clear')).not.toContain('context')
  })

  it('omits context when empty string', () => {
    expect(buildKagiUrl('Hello', 'Clear', '   ')).not.toContain('context')
  })
})
```

- [ ] **Step 2: Create package scaffolding**

Create `packages/kagi-sidecar/package.json`:

```json
{
  "name": "@chatwork-bot/kagi-sidecar",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "bun --hot src/index.ts",
    "start": "bun src/index.ts",
    "lint": "eslint \"**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "elysia": "^1.4.27",
    "logixlysia": "^6.2.0",
    "puppeteer": "^24.40.0",
    "puppeteer-real-browser": "^1.4.4"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

Create `packages/kagi-sidecar/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["packages/kagi-sidecar/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/kagi-sidecar && bun test src/url-builder.test.ts
```

Expected: FAIL — `Cannot find module './url-builder'`

- [ ] **Step 4: Implement url-builder.ts**

Create `packages/kagi-sidecar/src/url-builder.ts`:

```typescript
export type KagiStyle = 'Wild' | 'Easy' | 'Clear' | 'Smart' | 'Fine' | 'True'

interface KagiTranslationParams {
  style: 'natural' | 'literal'
  formality: 'standard' | 'vietnamese_casual' | 'vietnamese_formal'
  readingLevel: 'standard' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'
}

const STYLE_PARAMS: Record<KagiStyle, KagiTranslationParams> = {
  Wild: { style: 'natural', formality: 'vietnamese_casual', readingLevel: 'c2' },
  Easy: { style: 'natural', formality: 'vietnamese_casual', readingLevel: 'b2' },
  Clear: { style: 'natural', formality: 'standard', readingLevel: 'standard' },
  Smart: { style: 'natural', formality: 'vietnamese_formal', readingLevel: 'b2' },
  Fine: { style: 'natural', formality: 'vietnamese_formal', readingLevel: 'c1' },
  True: { style: 'literal', formality: 'standard', readingLevel: 'b2' },
}

const BASE_URL = 'https://translate.kagi.com/'

export function buildKagiUrl(text: string, style: KagiStyle, context?: string): string {
  const p = STYLE_PARAMS[style]
  const url = new URLSearchParams()

  url.set('from', 'auto')
  url.set('to', 'vi')
  url.set('text', text)

  if (p.readingLevel !== 'standard') {
    url.set('language_complexity', p.readingLevel)
  }

  if (p.style !== 'natural') {
    url.set('style', p.style)
  }

  if (p.formality === 'vietnamese_formal') {
    url.set('formality', 'more')
    url.set('formality_context', 'vi_formal')
  } else if (p.formality === 'vietnamese_casual') {
    url.set('formality', 'more')
    url.set('formality_context', 'vi_casual')
  }

  if (context !== undefined && context.trim().length > 0) {
    url.set('context', context.trim())
  }

  return `${BASE_URL}?${url.toString()}`
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/kagi-sidecar && bun test src/url-builder.test.ts
```

Expected: PASS — 9 tests

- [ ] **Step 6: Commit**

```bash
git add packages/kagi-sidecar/
git commit -m "feat(translator): scaffold kagi-sidecar package with url-builder"
```

---

## Task 2: kagi-sidecar — browser-service + server + index

**Files:**

- Create: `packages/kagi-sidecar/src/browser-service.ts`
- Create: `packages/kagi-sidecar/src/server.ts`
- Create: `packages/kagi-sidecar/src/index.ts`

Note: `browser-service.ts` wraps Puppeteer and cannot be unit-tested without a real browser — no test file for it. `server.ts` is tested via task integration in docker-compose.

- [ ] **Step 1: Create browser-service.ts**

Create `packages/kagi-sidecar/src/browser-service.ts`:

```typescript
import { connect } from 'puppeteer-real-browser'
import type { Browser, Page } from 'puppeteer-core'
import { buildKagiUrl } from './url-builder'
import type { KagiStyle } from './url-builder'

export interface TranslateParams {
  text: string
  style: KagiStyle
  context?: string
}

export class KagiBrowserService {
  private browser: Browser | null = null
  private page: Page | null = null

  async ensureLaunched(): Promise<void> {
    if (this.browser !== null) return

    try {
      const { browser, page } = (await connect({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        customConfig: {},
        turnstile: true,
        connectOption: {},
        disableXvfb: false,
        ignoreAllFlags: false,
      })) as unknown as { browser: Browser; page: Page }

      this.browser = browser
      this.page = page
    } catch (error) {
      throw new Error(
        `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async translate(params: TranslateParams): Promise<string> {
    await this.ensureLaunched()

    if (this.page === null) throw new Error('Browser page not initialized')

    const url = buildKagiUrl(params.text, params.style, params.context)

    try {
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 })

      try {
        await this.page.waitForSelector('.translation-content > span', {
          timeout: 20_000,
          visible: true,
        })
        await new Promise<void>((resolve) => setTimeout(resolve, 500))
      } catch {
        console.warn(
          JSON.stringify({
            level: 'warn',
            service: 'kagi-sidecar',
            event: 'selector_timeout',
          }),
        )
      }

      const result = await this.scrapeTranslatedText()

      if (result.trim() === '' || result.startsWith('[No translation')) {
        throw new Error(`Scraping returned no result: ${result}`)
      }

      return result
    } catch (error) {
      // Reset browser state so next request re-launches cleanly
      this.browser = null
      this.page = null
      throw error
    }
  }

  private async scrapeTranslatedText(): Promise<string> {
    const page = this.page!

    const result = await page.evaluate(() => {
      const translationContent = document.querySelector('.translation-content')
      if (translationContent !== null) {
        const textSpan = translationContent.querySelector('span')
        if (textSpan?.textContent?.trim()) return textSpan.textContent.trim()
        if (translationContent.textContent?.trim()) return translationContent.textContent.trim()
      }

      const outputArea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder]')
      if (outputArea?.value) return outputArea.value

      const allTextareas = document.querySelectorAll('textarea')
      if (allTextareas.length >= 2) {
        const second = allTextareas.item(1)
        if (second.value !== '') return second.value
      }

      return '[No translation result found — check DOM structure]'
    })

    return result
  }

  async close(): Promise<void> {
    if (this.browser !== null) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }
}
```

- [ ] **Step 2: Create server.ts**

Create `packages/kagi-sidecar/src/server.ts`:

```typescript
import { Elysia, t } from 'elysia'
import logixlysia from 'logixlysia'
import type { KagiBrowserService } from './browser-service'
import type { KagiStyle } from './url-builder'

const KAGI_STYLE_VALUES = ['Wild', 'Easy', 'Clear', 'Smart', 'Fine', 'True'] as const

export function createKagiServer(browserService: KagiBrowserService) {
  const app = new Elysia({ name: 'kagi-sidecar' })

  app.use(
    logixlysia({
      config: {
        showStartupMessage: false,
        ip: false,
        customLogFormat:
          '🦊 {now} {level} {duration} {method} {pathname} {status} {message} {context}',
      },
    }),
  )

  return app
    .get('/health', () => ({ status: 'ok' }))
    .post(
      '/translate',
      async ({ body, set }) => {
        console.log(
          JSON.stringify({
            level: 'info',
            service: 'kagi-sidecar',
            event: 'translate_request',
            style: body.style,
            hasContext: body.context !== undefined && body.context !== null,
          }),
        )

        try {
          const translated = await browserService.translate({
            text: body.text,
            style: body.style as KagiStyle,
            context: body.context ?? undefined,
          })
          return { translated }
        } catch (error) {
          console.error(
            JSON.stringify({
              level: 'error',
              service: 'kagi-sidecar',
              event: 'browser_error',
              operation: 'translate',
              error: error instanceof Error ? error.message : String(error),
            }),
          )
          set.status = 503
          return {
            error: 'Translation failed',
            detail: error instanceof Error ? error.message : String(error),
          }
        }
      },
      {
        body: t.Object({
          text: t.String({ minLength: 1 }),
          style: t.Union(KAGI_STYLE_VALUES.map((s) => t.Literal(s))),
          context: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
        }),
      },
    )
}
```

- [ ] **Step 3: Create index.ts**

Create `packages/kagi-sidecar/src/index.ts`:

```typescript
import { KagiBrowserService } from './browser-service'
import { createKagiServer } from './server'

const PORT = Number(process.env['KAGI_PORT'] ?? '3002')

const browserService = new KagiBrowserService()
const app = createKagiServer(browserService)

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      service: 'kagi-sidecar',
      event: 'server_started',
      port: PORT,
    }),
  )
})

function shutdown() {
  console.log('\n[kagi-sidecar] Shutting down...')
  void browserService.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

- [ ] **Step 4: Run typecheck**

```bash
cd packages/kagi-sidecar && bun run typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/kagi-sidecar/src/
git commit -m "feat(translator): add kagi-sidecar browser-service, server, and index"
```

---

## Task 3: provider-kagi — KagiClient package

**Files:**

- Create: `packages/provider-kagi/package.json`
- Create: `packages/provider-kagi/tsconfig.json`
- Create: `packages/provider-kagi/src/types.ts`
- Create: `packages/provider-kagi/src/kagi-client.ts`
- Create: `packages/provider-kagi/src/kagi-client.test.ts`
- Create: `packages/provider-kagi/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/provider-kagi/src/kagi-client.test.ts`:

```typescript
import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { KagiClient, KagiClientError } from './kagi-client'

describe('KagiClient', () => {
  afterEach(() => {
    // bun:test spyOn restores automatically per test, but explicit restore is safer
  })

  it('translate() returns translated text on 200', async () => {
    spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ translated: 'Xin chào' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const client = new KagiClient({ baseUrl: 'http://localhost:3002' })
    const result = await client.translate({ text: 'Hello', style: 'Clear' })

    expect(result.translated).toBe('Xin chào')
  })

  it('translate() sends correct URL and body', async () => {
    const fetchSpy = spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ translated: 'Kết quả' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const client = new KagiClient({ baseUrl: 'http://kagi-translator:3002' })
    await client.translate({ text: 'Test', style: 'Wild', context: 'dev team' })

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://kagi-translator:3002/translate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const body = JSON.parse((fetchSpy.mock.calls[0]?.[1] as RequestInit).body as string) as unknown
    expect(body).toMatchObject({ text: 'Test', style: 'Wild', context: 'dev team' })
  })

  it('translate() throws KagiClientError on non-ok response', async () => {
    spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Translation failed' }), { status: 503 }),
    )

    const client = new KagiClient({ baseUrl: 'http://localhost:3002' })
    const error = await client.translate({ text: 'Hello', style: 'Clear' }).catch((e) => e)

    expect(error).toBeInstanceOf(KagiClientError)
    expect((error as KagiClientError).statusCode).toBe(503)
  })

  it('translate() throws KagiClientError on network error', async () => {
    spyOn(global, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const client = new KagiClient({ baseUrl: 'http://localhost:3002' })
    const error = await client.translate({ text: 'Hello', style: 'Clear' }).catch((e) => e)

    expect(error).toBeInstanceOf(KagiClientError)
    expect((error as KagiClientError).statusCode).toBe(0)
  })

  it('baseUrl trailing slash is normalized', async () => {
    const fetchSpy = spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ translated: 'x' }), { status: 200 }),
    )

    const client = new KagiClient({ baseUrl: 'http://localhost:3002/' })
    await client.translate({ text: 'Hi', style: 'Clear' })

    expect(fetchSpy.mock.calls[0]?.[0] as string).toBe('http://localhost:3002/translate')
  })
})
```

- [ ] **Step 2: Create package scaffolding**

Create `packages/provider-kagi/package.json`:

```json
{
  "name": "@chatwork-bot/provider-kagi",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "scripts": {
    "lint": "eslint \"**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  }
}
```

Create `packages/provider-kagi/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "rootDir": "src",
    "outDir": "dist",
    "paths": {
      "~/*": ["packages/provider-kagi/src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/provider-kagi && bun test src/kagi-client.test.ts
```

Expected: FAIL — `Cannot find module './kagi-client'`

- [ ] **Step 4: Implement types.ts + kagi-client.ts + index.ts**

Create `packages/provider-kagi/src/types.ts`:

```typescript
export const KAGI_STYLE_VALUES = ['Wild', 'Easy', 'Clear', 'Smart', 'Fine', 'True'] as const

export type KagiStyle = (typeof KAGI_STYLE_VALUES)[number]

export interface KagiTranslateRequest {
  text: string
  style: KagiStyle
  context?: string
}

export interface KagiTranslateResponse {
  translated: string
}
```

Create `packages/provider-kagi/src/kagi-client.ts`:

```typescript
import type { KagiTranslateRequest, KagiTranslateResponse } from './types'

export class KagiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message)
    this.name = 'KagiClientError'
  }
}

interface KagiClientOptions {
  baseUrl: string
}

export class KagiClient {
  private readonly baseUrl: string

  constructor({ baseUrl }: KagiClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async translate(request: KagiTranslateRequest): Promise<KagiTranslateResponse> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
    } catch (error) {
      throw new KagiClientError(
        `Network error calling kagi-translator: ${error instanceof Error ? error.message : String(error)}`,
        0,
      )
    }

    if (!response.ok) {
      const body = await response.text()
      throw new KagiClientError(
        `kagi-translator returned ${response.status.toString()}: ${body}`,
        response.status,
      )
    }

    return (await response.json()) as KagiTranslateResponse
  }
}
```

Create `packages/provider-kagi/src/index.ts`:

```typescript
export { KagiClient, KagiClientError } from './kagi-client'
export { KAGI_STYLE_VALUES } from './types'
export type { KagiStyle, KagiTranslateRequest, KagiTranslateResponse } from './types'
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/provider-kagi && bun test src/kagi-client.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 6: Commit**

```bash
git add packages/provider-kagi/
git commit -m "feat(translator): add provider-kagi package with KagiClient"
```

---

## Task 4: translator — FreeRoomConfig types + FreeRoomConfigStore

**Files:**

- Create: `packages/translator/src/types/free-room-config.ts`
- Create: `packages/translator/src/services/free-room-config-store.ts`
- Test: `packages/translator/src/services/free-room-config-store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/translator/src/services/free-room-config-store.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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

  it('init() creates an empty store', () => {
    expect(store.list()).toHaveLength(0)
  })

  it('init() fails with INVALID_CONFIG_FILE on corrupt JSON', async () => {
    await writeFile(join(tmpDir, 'free-room-configs.json'), '{ not-valid }', 'utf-8')
    const brokenStore = new FreeRoomConfigStore({ dataDir: tmpDir })
    const error = await catchError(brokenStore.init())
    expect(error).toBeInstanceOf(FreeRoomConfigStoreError)
    expect((error as FreeRoomConfigStoreError).code).toBe('INVALID_CONFIG_FILE')
    expect((error as Error).message).toContain('free-room-configs.json')
  })

  it('create() stores a room with id + timestamps + enabled=true', async () => {
    const room = await store.create({
      originalRoomId: 111,
      destinationRoomId: 222,
      destinationRoomName: '#vi-team',
      kagiStyle: 'Clear',
    })
    expect(room.id).toBeString()
    expect(room.originalRoomId).toBe(111)
    expect(room.destinationRoomId).toBe(222)
    expect(room.kagiStyle).toBe('Clear')
    expect(room.enabled).toBe(true)
    expect(room.createdAt).toBeString()
    expect(store.list()).toHaveLength(1)
  })

  it('create() throws DUPLICATE_ORIGINAL_ROOM_ID for duplicate originalRoomId', async () => {
    await store.create({ originalRoomId: 111, destinationRoomId: 222, destinationRoomName: '#a' })
    const error = await catchError(
      store.create({ originalRoomId: 111, destinationRoomId: 333, destinationRoomName: '#b' }),
    )
    expect(error).toBeInstanceOf(FreeRoomConfigStoreError)
    expect((error as FreeRoomConfigStoreError).code).toBe('DUPLICATE_ORIGINAL_ROOM_ID')
  })

  it('getByOriginalRoomId() finds room after create', async () => {
    const room = await store.create({
      originalRoomId: 111,
      destinationRoomId: 222,
      destinationRoomName: '#vi-team',
    })
    expect(store.getByOriginalRoomId(111)?.id).toBe(room.id)
  })

  it('getByOriginalRoomId() returns null for unknown room', () => {
    expect(store.getByOriginalRoomId(999)).toBeNull()
  })

  it('update() patches only specified fields', async () => {
    const room = await store.create({
      originalRoomId: 111,
      destinationRoomId: 222,
      destinationRoomName: '#vi-team',
      kagiStyle: 'Clear',
    })
    const updated = await store.update(room.id, { kagiStyle: 'Wild' })
    expect(updated.kagiStyle).toBe('Wild')
    expect(updated.destinationRoomName).toBe('#vi-team')
    expect(updated.updatedAt >= room.updatedAt).toBe(true)
  })

  it('update() throws NOT_FOUND for unknown id', async () => {
    const error = await catchError(store.update('nonexistent-id', { kagiStyle: 'Wild' }))
    expect(error).toBeInstanceOf(FreeRoomConfigStoreError)
    expect((error as FreeRoomConfigStoreError).code).toBe('NOT_FOUND')
  })

  it('setEnabled() toggles enabled flag', async () => {
    const room = await store.create({
      originalRoomId: 111,
      destinationRoomId: 222,
      destinationRoomName: '#vi-team',
    })
    const disabled = await store.setEnabled(room.id, false)
    expect(disabled.enabled).toBe(false)
    const reenabled = await store.setEnabled(room.id, true)
    expect(reenabled.enabled).toBe(true)
  })

  it('delete() removes room from list', async () => {
    const room = await store.create({
      originalRoomId: 111,
      destinationRoomId: 222,
      destinationRoomName: '#vi-team',
    })
    await store.delete(room.id)
    expect(store.list()).toHaveLength(0)
    expect(store.getById(room.id)).toBeNull()
  })

  it('delete() throws NOT_FOUND for unknown id', async () => {
    const error = await catchError(store.delete('nonexistent-id'))
    expect(error).toBeInstanceOf(FreeRoomConfigStoreError)
    expect((error as FreeRoomConfigStoreError).code).toBe('NOT_FOUND')
  })

  it('data persists across re-init', async () => {
    await store.create({
      originalRoomId: 111,
      destinationRoomId: 222,
      destinationRoomName: '#vi-team',
    })
    const store2 = new FreeRoomConfigStore({ dataDir: tmpDir })
    await store2.init()
    expect(store2.list()).toHaveLength(1)
    expect(store2.getByOriginalRoomId(111)).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/translator && bun test src/services/free-room-config-store.test.ts
```

Expected: FAIL — `Cannot find module './free-room-config-store'`

- [ ] **Step 3: Implement free-room-config.ts**

Create `packages/translator/src/types/free-room-config.ts`:

```typescript
import { z } from 'zod'
import { KeywordEntrySchema } from '~/types/keyword-entry'

export const KAGI_STYLE_VALUES = ['Wild', 'Easy', 'Clear', 'Smart', 'Fine', 'True'] as const

export type KagiStyle = (typeof KAGI_STYLE_VALUES)[number]

export const FreeRoomConfigSchema = z.object({
  id: z.uuid(),
  originalRoomId: z.number().int().positive(),
  destinationRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1),
  kagiStyle: z.enum(KAGI_STYLE_VALUES).default('Clear'),
  context: z.string().max(100).nullable().optional().default(null),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type FreeRoomConfig = z.infer<typeof FreeRoomConfigSchema>

export const FreeRoomConfigFileSchema = z.object({
  version: z.literal(1),
  rooms: z.array(FreeRoomConfigSchema),
})

export type FreeRoomConfigFile = z.infer<typeof FreeRoomConfigFileSchema>

export const CreateFreeRoomRequestSchema = z.object({
  originalRoomId: z.number().int().positive(),
  destinationRoomName: z.string().min(1).max(128),
  kagiStyle: z.enum(KAGI_STYLE_VALUES).default('Clear'),
  context: z.string().max(100).nullable().optional().default(null),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
})

export type CreateFreeRoomRequest = z.infer<typeof CreateFreeRoomRequestSchema>

export const UpdateFreeRoomRequestSchema = z.object({
  destinationRoomName: z.string().min(1).max(128).optional(),
  kagiStyle: z.enum(KAGI_STYLE_VALUES).optional(),
  context: z.string().max(100).nullable().optional(),
  protectedKeywords: z.array(KeywordEntrySchema).max(50).optional(),
})

export type UpdateFreeRoomRequest = z.infer<typeof UpdateFreeRoomRequestSchema>
```

- [ ] **Step 4: Implement free-room-config-store.ts**

Create `packages/translator/src/services/free-room-config-store.ts`:

```typescript
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { FreeRoomConfigFileSchema } from '~/types/free-room-config'
import type {
  FreeRoomConfig,
  FreeRoomConfigFile,
  UpdateFreeRoomRequest,
} from '~/types/free-room-config'
import type { KeywordEntry } from '~/types/keyword-entry'

export class FreeRoomConfigStoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'FreeRoomConfigStoreError'
  }
}

interface CreateFreeRoomStoreParams {
  originalRoomId: number
  destinationRoomId: number
  destinationRoomName: string
  kagiStyle?: 'Wild' | 'Easy' | 'Clear' | 'Smart' | 'Fine' | 'True'
  context?: string | null
  protectedKeywords?: KeywordEntry[]
}

interface FreeRoomConfigStoreOptions {
  dataDir: string
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
      const room: FreeRoomConfig = {
        id: crypto.randomUUID(),
        originalRoomId: params.originalRoomId,
        destinationRoomId: params.destinationRoomId,
        destinationRoomName: params.destinationRoomName,
        kagiStyle: params.kagiStyle ?? 'Clear',
        context: params.context ?? null,
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
        throw new FreeRoomConfigStoreError(`Free room ${id} not found`, 'NOT_FOUND')
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
        throw new FreeRoomConfigStoreError(`Free room ${id} not found`, 'NOT_FOUND')
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
        throw new FreeRoomConfigStoreError(`Free room ${id} not found`, 'NOT_FOUND')
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
        const empty: FreeRoomConfigFile = { version: 1, rooms: [] }
        await this.writeConfig(empty)
        return empty
      }

      throw new FreeRoomConfigStoreError(
        `Failed to load free room config store from ${this.configPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'INVALID_CONFIG_FILE',
      )
    }
  }

  private rebuildIndex(rooms: FreeRoomConfig[]): void {
    this.roomsByOriginalId = new Map(rooms.map((r) => [r.originalRoomId, r]))
    this.roomsById = new Map(rooms.map((r) => [r.id, r]))
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/translator && bun test src/services/free-room-config-store.test.ts
```

Expected: PASS — 11 tests

- [ ] **Step 6: Commit**

```bash
git add packages/translator/src/types/free-room-config.ts \
        packages/translator/src/services/free-room-config-store.ts \
        packages/translator/src/services/free-room-config-store.test.ts
git commit -m "feat(translator): add FreeRoomConfig types and FreeRoomConfigStore"
```

---

## Task 5: translator — /api/free-rooms routes + app/server wiring

**Files:**

- Create: `packages/translator/src/routes/free-rooms.ts`
- Modify: `packages/translator/src/app.ts`
- Modify: `packages/translator/src/server.ts`

- [ ] **Step 1: Create free-rooms.ts**

Create `packages/translator/src/routes/free-rooms.ts`:

```typescript
import {
  createRoom as createChatworkRoom,
  deleteRoom as deleteChatworkRoom,
  updateRoom as updateChatworkRoom,
} from '@chatwork-bot/chatwork'
import { Elysia, t } from 'elysia'
import { FreeRoomConfigStoreError } from '~/services/free-room-config-store'
import type { FreeRoomConfigStore } from '~/services/free-room-config-store'
import { CreateFreeRoomRequestSchema, UpdateFreeRoomRequestSchema } from '~/types/free-room-config'

interface FreeRoomsRoutesOptions {
  freeRoomStore: FreeRoomConfigStore
  chatworkApiToken: string
  chatworkBotAccountId: number
}

function resolvePublicOrigin(request: Request): string {
  const fwdHost = request.headers.get('x-forwarded-host')
  const fwdProto = request.headers.get('x-forwarded-proto') ?? 'https'
  if (fwdHost) return `${fwdProto}://${fwdHost}`
  return new URL(request.url).origin
}

function errorResponse(status: number, error: string, details?: unknown) {
  return {
    status,
    body: details === undefined ? { error } : { error, details },
  }
}

function hasStatusCode(error: unknown, statusCode: number): boolean {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode === statusCode
  )
}

export function createFreeRoomsRoutes({
  freeRoomStore,
  chatworkApiToken,
  chatworkBotAccountId,
}: FreeRoomsRoutesOptions) {
  return new Elysia({ name: 'translator:free-rooms' })
    .get('/api/free-rooms', () => {
      return { success: true, data: freeRoomStore.list() }
    })
    .get('/api/free-rooms/:id', ({ params, set }) => {
      const room = freeRoomStore.getById(params.id)
      if (room === null) {
        set.status = 404
        return { error: 'Free room not found' }
      }
      return { success: true, data: room }
    })
    .post(
      '/api/free-rooms',
      async ({ body, request, set }) => {
        const parsed = CreateFreeRoomRequestSchema.safeParse(body)
        if (!parsed.success) {
          const r = errorResponse(400, 'Invalid request body', parsed.error.issues)
          set.status = r.status
          return r.body
        }

        const data = parsed.data
        if (freeRoomStore.getByOriginalRoomId(data.originalRoomId) !== null) {
          const r = errorResponse(
            409,
            `originalRoomId ${data.originalRoomId.toString()} already exists`,
          )
          set.status = r.status
          return r.body
        }

        let destinationRoomId: number
        try {
          const created = await createChatworkRoom(
            { name: data.destinationRoomName, members_admin_ids: chatworkBotAccountId.toString() },
            chatworkApiToken,
          )
          destinationRoomId = created.room_id
        } catch (error) {
          const r = errorResponse(
            502,
            'Failed to create destination room on Chatwork',
            error instanceof Error ? error.message : String(error),
          )
          set.status = r.status
          return r.body
        }

        const room = await freeRoomStore.create({ ...data, destinationRoomId })
        const webhookUrl = `${resolvePublicOrigin(request)}/webhook`
        set.status = 201
        return { success: true, data: room, webhookUrl }
      },
      { body: t.Unknown() },
    )
    .put(
      '/api/free-rooms/:id',
      async ({ body, params, set }) => {
        const parsed = UpdateFreeRoomRequestSchema.safeParse(body)
        if (!parsed.success) {
          const r = errorResponse(400, 'Invalid request body', parsed.error.issues)
          set.status = r.status
          return r.body
        }

        const existing = freeRoomStore.getById(params.id)
        if (existing === null) {
          const r = errorResponse(404, 'Free room not found')
          set.status = r.status
          return r.body
        }

        const nextName = parsed.data.destinationRoomName
        if (nextName !== undefined && nextName !== existing.destinationRoomName) {
          try {
            await updateChatworkRoom(
              existing.destinationRoomId,
              { name: nextName },
              chatworkApiToken,
            )
          } catch (error) {
            const r = errorResponse(
              502,
              'Failed to update destination room on Chatwork',
              error instanceof Error ? error.message : String(error),
            )
            set.status = r.status
            return r.body
          }
        }

        try {
          const room = await freeRoomStore.update(params.id, parsed.data)
          return { success: true, data: room }
        } catch (error) {
          if (error instanceof FreeRoomConfigStoreError && error.code === 'NOT_FOUND') {
            const r = errorResponse(404, 'Free room not found')
            set.status = r.status
            return r.body
          }
          throw error
        }
      },
      { body: t.Unknown() },
    )
    .delete('/api/free-rooms/:id', async ({ params, set }) => {
      const room = freeRoomStore.getById(params.id)
      if (room === null) {
        const r = errorResponse(404, 'Free room not found')
        set.status = r.status
        return r.body
      }

      let outcome: 'deleted' | 'already_deleted' = 'deleted'
      try {
        await deleteChatworkRoom(room.destinationRoomId, chatworkApiToken)
      } catch (error) {
        if (hasStatusCode(error, 404)) {
          outcome = 'already_deleted'
        } else {
          const r = errorResponse(
            502,
            'Failed to delete destination room on Chatwork',
            error instanceof Error ? error.message : String(error),
          )
          set.status = r.status
          return r.body
        }
      }

      try {
        await freeRoomStore.delete(params.id)
      } catch (error) {
        if (error instanceof FreeRoomConfigStoreError && error.code === 'NOT_FOUND') {
          return { success: true, data: { outcome } }
        }
        const r = errorResponse(
          500,
          'Chatwork room was deleted, but local cleanup failed',
          error instanceof Error ? error.message : String(error),
        )
        set.status = r.status
        return r.body
      }

      return { success: true, data: { outcome } }
    })
    .post('/api/free-rooms/:id/enable', async ({ params, set }) => {
      try {
        const room = await freeRoomStore.setEnabled(params.id, true)
        return { success: true, data: room }
      } catch (error) {
        if (error instanceof FreeRoomConfigStoreError && error.code === 'NOT_FOUND') {
          const r = errorResponse(404, 'Free room not found')
          set.status = r.status
          return r.body
        }
        throw error
      }
    })
    .post('/api/free-rooms/:id/disable', async ({ params, set }) => {
      try {
        const room = await freeRoomStore.setEnabled(params.id, false)
        return { success: true, data: room }
      } catch (error) {
        if (error instanceof FreeRoomConfigStoreError && error.code === 'NOT_FOUND') {
          const r = errorResponse(404, 'Free room not found')
          set.status = r.status
          return r.body
        }
        throw error
      }
    })
}
```

- [ ] **Step 2: Wire into app.ts**

In `packages/translator/src/app.ts`, add two lines:

After the existing import `import { createRoomsRoutes } from './routes/rooms'`, add:

```typescript
import { createFreeRoomsRoutes } from './routes/free-rooms'
import type { FreeRoomConfigStore } from './services/free-room-config-store'
```

Change `interface AppOptions` from:

```typescript
interface AppOptions {
  store: RoomConfigStore
}
```

to:

```typescript
interface AppOptions {
  store: RoomConfigStore
  freeRoomStore: FreeRoomConfigStore
}
```

Change `export function createApp({ store }: AppOptions)` to `export function createApp({ store, freeRoomStore }: AppOptions)`.

After the `.use(createRoomsRoutes({...}))` block, add:

```typescript
    .use(
      createFreeRoomsRoutes({
        freeRoomStore,
        chatworkApiToken: env.CHATWORK_API_TOKEN,
        chatworkBotAccountId: env.CHATWORK_BOT_ACCOUNT_ID,
      }),
    )
```

- [ ] **Step 3: Wire into server.ts**

Replace `packages/translator/src/server.ts` entirely:

```typescript
import type { RoomConfigStore } from './services/room-config-store'
import type { FreeRoomConfigStore } from './services/free-room-config-store'
import { createApp } from './app'

interface ServerOptions {
  store: RoomConfigStore
  freeRoomStore: FreeRoomConfigStore
}

export function createServer({ store, freeRoomStore }: ServerOptions) {
  return createApp({ store, freeRoomStore })
}
```

- [ ] **Step 4: Run typecheck to verify no errors**

```bash
cd packages/translator && bun run typecheck
```

Expected: no errors (index.ts will have an error until Task 6 — check only routes + app + server)

- [ ] **Step 5: Commit**

```bash
git add packages/translator/src/routes/free-rooms.ts \
        packages/translator/src/app.ts \
        packages/translator/src/server.ts
git commit -m "feat(translator): add /api/free-rooms routes and wire into app"
```

---

## Task 6: translator — env + free-handler + router dispatch + index wiring

**Files:**

- Modify: `packages/translator/src/env-schema.ts`
- Create: `packages/translator/src/webhook/free-handler.ts`
- Create: `packages/translator/src/webhook/free-handler.test.ts`
- Modify: `packages/translator/src/webhook/router.ts`
- Modify: `packages/translator/src/index.ts`
- Modify: `packages/translator/package.json`

- [ ] **Step 1: Write the failing test**

Create `packages/translator/src/webhook/free-handler.test.ts`:

```typescript
import { describe, expect, it, mock, spyOn } from 'bun:test'
import { createHandleFreeTranslateRequest } from './free-handler'
import type { FreeRoomConfigStore } from '~/services/free-room-config-store'
import type { KagiClient } from '@chatwork-bot/provider-kagi'
import type { TranslationIngressCommand } from '@chatwork-bot/core'

const NOOP_COMMAND: TranslationIngressCommand = {
  sourceRoomId: 111,
  sourceMessageId: 'msg-1',
  sourceEventType: 'message_created',
  translatableText: 'Hello world',
  rawBody: 'Hello world',
  translationInputs: ['Hello world'],
  audit: { rawSourceSnapshot: {} },
}

function makeStore(overrides: Partial<FreeRoomConfigStore> = {}): FreeRoomConfigStore {
  return {
    getByOriginalRoomId: mock(() => null),
    list: mock(() => []),
    getById: mock(() => null),
    create: mock(() => Promise.resolve({} as never)),
    update: mock(() => Promise.resolve({} as never)),
    setEnabled: mock(() => Promise.resolve({} as never)),
    delete: mock(() => Promise.resolve()),
    init: mock(() => Promise.resolve()),
    ...overrides,
  } as unknown as FreeRoomConfigStore
}

function makeKagiClient(translated = 'Xin chào'): KagiClient {
  return {
    translate: mock(() => Promise.resolve({ translated })),
  } as unknown as KagiClient
}

describe('createHandleFreeTranslateRequest', () => {
  it('returns early (no-op) when no free room matches sourceRoomId', async () => {
    const store = makeStore({ getByOriginalRoomId: mock(() => null) })
    const kagiClient = makeKagiClient()
    const handler = createHandleFreeTranslateRequest({
      freeRoomStore: store,
      kagiClient,
      chatworkApiToken: 'token',
    })

    await handler(NOOP_COMMAND)

    expect(kagiClient.translate).not.toHaveBeenCalled()
  })

  it('returns early when room is disabled', async () => {
    const fakeRoom = {
      id: 'r1',
      originalRoomId: 111,
      destinationRoomId: 222,
      destinationRoomName: '#vi',
      kagiStyle: 'Clear' as const,
      context: null,
      protectedKeywords: [],
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const store = makeStore({ getByOriginalRoomId: mock(() => fakeRoom) })
    const kagiClient = makeKagiClient()
    const handler = createHandleFreeTranslateRequest({
      freeRoomStore: store,
      kagiClient,
      chatworkApiToken: 'token',
    })

    await handler(NOOP_COMMAND)

    expect(kagiClient.translate).not.toHaveBeenCalled()
  })

  it('calls kagiClient.translate with maskedText + style + context', async () => {
    const fakeRoom = {
      id: 'r1',
      originalRoomId: 111,
      destinationRoomId: 222,
      destinationRoomName: '#vi',
      kagiStyle: 'Wild' as const,
      context: 'dev team',
      protectedKeywords: [],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const store = makeStore({ getByOriginalRoomId: mock(() => fakeRoom) })
    const kagiClient = makeKagiClient('Kết quả')

    // Mock sendTranslatedMessage so we don't need real Chatwork
    const senderMod = await import('~/services/chatwork-sender')
    const sendSpy = spyOn(senderMod, 'sendTranslatedMessage').mockResolvedValueOnce({
      status: 'sent',
      destinationRoomId: 222,
      messages: [],
      sentAt: new Date().toISOString(),
    })

    const handler = createHandleFreeTranslateRequest({
      freeRoomStore: store,
      kagiClient,
      chatworkApiToken: 'token',
    })

    await handler(NOOP_COMMAND)

    expect(kagiClient.translate).toHaveBeenCalledWith(
      expect.objectContaining({ style: 'Wild', context: 'dev team' }),
    )
    expect(sendSpy).toHaveBeenCalled()
  })

  it('does not throw on kagiClient error — logs and swallows', async () => {
    const fakeRoom = {
      id: 'r1',
      originalRoomId: 111,
      destinationRoomId: 222,
      destinationRoomName: '#vi',
      kagiStyle: 'Clear' as const,
      context: null,
      protectedKeywords: [],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const store = makeStore({ getByOriginalRoomId: mock(() => fakeRoom) })
    const kagiClient = {
      translate: mock(() => Promise.reject(new Error('Kagi down'))),
    } as unknown as KagiClient

    const handler = createHandleFreeTranslateRequest({
      freeRoomStore: store,
      kagiClient,
      chatworkApiToken: 'token',
    })

    // Must not throw — errors are swallowed and logged
    await expect(handler(NOOP_COMMAND)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/translator && bun test src/webhook/free-handler.test.ts
```

Expected: FAIL — `Cannot find module './free-handler'`

- [ ] **Step 3: Add KAGI_TRANSLATOR_URL to env-schema.ts**

In `packages/translator/src/env-schema.ts`, add this line inside the `translatorEnvSchema` object (after `TRANSLATOR_STATUS_HISTORY_LIMIT`):

```typescript
  KAGI_TRANSLATOR_URL: z.string().default('http://kagi-translator:3002'),
```

- [ ] **Step 4: Add provider-kagi dep to translator package.json**

In `packages/translator/package.json`, add to `"dependencies"`:

```json
"@chatwork-bot/provider-kagi": "workspace:*",
```

- [ ] **Step 5: Create free-handler.ts**

Create `packages/translator/src/webhook/free-handler.ts`:

```typescript
import type { TranslationIngressCommand, TranslationResult } from '@chatwork-bot/core'
import type { KagiClient } from '@chatwork-bot/provider-kagi'
import type { FreeRoomConfigStore } from '~/services/free-room-config-store'
import { mask as maskKeywords, restore as restoreKeywords } from '~/services/keyword-redactor'
import { sendTranslatedMessage } from '~/services/chatwork-sender'

interface HandleFreeTranslateRequestDeps {
  freeRoomStore: FreeRoomConfigStore
  kagiClient: KagiClient
  chatworkApiToken: string
}

interface FreeTranslateRequestContext {
  traceId?: string
}

let freeTranslateHandler:
  | ((command: TranslationIngressCommand, context?: FreeTranslateRequestContext) => Promise<void>)
  | null = null

export function initFreeTranslateHandler(deps: HandleFreeTranslateRequestDeps): void {
  freeTranslateHandler = createHandleFreeTranslateRequest(deps)
}

export function createHandleFreeTranslateRequest(deps: HandleFreeTranslateRequestDeps) {
  return async function handleFreeTranslateRequestInner(
    command: TranslationIngressCommand,
    context: FreeTranslateRequestContext = {},
  ): Promise<void> {
    const traceId = context.traceId ?? crypto.randomUUID()
    const room = deps.freeRoomStore.getByOriginalRoomId(command.sourceRoomId)

    if (room === null) {
      console.log(
        JSON.stringify({
          level: 'warn',
          service: 'translator',
          event: 'free_room_not_found',
          roomType: 'free',
          timestamp: new Date().toISOString(),
          traceId,
          sourceRoomId: command.sourceRoomId,
        }),
      )
      return
    }

    if (!room.enabled) {
      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'free_translation_skipped_room_disabled',
          roomType: 'free',
          timestamp: new Date().toISOString(),
          traceId,
          roomId: room.id,
        }),
      )
      return
    }

    if (command.translatableText.trim() === '') return

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'translator',
        event: 'free_translation_ingress',
        roomType: 'free',
        timestamp: new Date().toISOString(),
        traceId,
        roomId: room.id,
        sourceRoomId: command.sourceRoomId,
      }),
    )

    try {
      const cleanText = command.translatableText
      const keywords = room.protectedKeywords ?? []
      const { maskedText, restoreMap } = maskKeywords(cleanText, keywords)

      const { translated } = await deps.kagiClient.translate({
        text: maskedText,
        style: room.kagiStyle,
        context: room.context ?? undefined,
      })

      const finalText = restoreKeywords(translated, restoreMap)

      const result: TranslationResult = {
        cleanText: maskedText,
        translatedText: finalText,
        sourceLang: 'auto',
        targetLang: 'Vietnamese',
        timestamp: new Date().toISOString(),
      }

      await sendTranslatedMessage(command, result, {
        apiToken: deps.chatworkApiToken,
        destinationRoomId: room.destinationRoomId,
        translatedSegments: [finalText],
      })

      console.log(
        JSON.stringify({
          level: 'info',
          service: 'translator',
          event: 'free_translation_completed',
          roomType: 'free',
          timestamp: new Date().toISOString(),
          traceId,
          roomId: room.id,
        }),
      )
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'translator',
          event: 'free_translation_failed',
          roomType: 'free',
          timestamp: new Date().toISOString(),
          traceId,
          roomId: room.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    }
  }
}

export async function handleFreeTranslateRequest(
  command: TranslationIngressCommand,
  context?: FreeTranslateRequestContext,
): Promise<void> {
  if (freeTranslateHandler === null) {
    throw new Error('Free translate handler not initialized')
  }
  return freeTranslateHandler(command, context)
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd packages/translator && bun test src/webhook/free-handler.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 7: Add dispatch to router.ts**

In `packages/translator/src/webhook/router.ts`, add this import after the existing import:

```typescript
import { handleFreeTranslateRequest } from './free-handler'
```

Inside the POST handler body, after the existing `void handleTranslateRequest(...).catch(...)` block, add:

```typescript
void handleFreeTranslateRequest(body.command, { traceId }).catch((err: unknown) => {
  console.error(
    JSON.stringify({
      level: 'error',
      service: 'translator',
      event: 'free_translation_ingress_dispatch_failed',
      roomType: 'free',
      timestamp: new Date().toISOString(),
      traceId,
      sourceMessageId: body.command.sourceMessageId,
      sourceRoomId: body.command.sourceRoomId,
      errorCode: err instanceof Error ? err.name : 'UnknownError',
      errorMessage: err instanceof Error ? err.message : String(err),
    }),
  )
})
```

- [ ] **Step 8: Wire FreeRoomConfigStore + KagiClient + initFreeTranslateHandler in index.ts**

In `packages/translator/src/index.ts`, add imports after existing imports:

```typescript
import { KagiClient } from '@chatwork-bot/provider-kagi'
import { FreeRoomConfigStore } from '~/services/free-room-config-store'
import { initFreeTranslateHandler } from '~/webhook/free-handler'
```

After the existing `await store.init()` line, add:

```typescript
const freeRoomStore = new FreeRoomConfigStore({ dataDir: env.ROOM_CONFIG_DATA_DIR })
await freeRoomStore.init()

const kagiClient = new KagiClient({ baseUrl: env.KAGI_TRANSLATOR_URL })

initFreeTranslateHandler({
  freeRoomStore,
  kagiClient,
  chatworkApiToken: env.CHATWORK_API_TOKEN,
})
```

Change the existing `const server = createServer({ store })` line to:

```typescript
const server = createServer({ store, freeRoomStore })
```

Add log line after existing room count log:

```typescript
console.log(
  `[translator] Free room config API: http://localhost:${env.PORT.toString()}/api/free-rooms`,
)
```

- [ ] **Step 9: Run full translator tests**

```bash
cd packages/translator && bun test
```

Expected: all tests pass

- [ ] **Step 10: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add packages/translator/src/env-schema.ts \
        packages/translator/src/webhook/free-handler.ts \
        packages/translator/src/webhook/free-handler.test.ts \
        packages/translator/src/webhook/router.ts \
        packages/translator/src/index.ts \
        packages/translator/package.json
git commit -m "feat(translator): add free-handler, router dispatch, and env wiring"
```

---

## Task 7: dashboard — free-room-schemas + free-room-api + free-room-store

**Files:**

- Create: `packages/dashboard/src/lib/free-room-schemas.ts`
- Create: `packages/dashboard/src/lib/free-room-schemas.test.ts`
- Create: `packages/dashboard/src/lib/free-room-api.ts`
- Create: `packages/dashboard/src/stores/free-room-store.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/dashboard/src/lib/free-room-schemas.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
import { freeRoomCreateSchema, freeRoomEditSchema, KAGI_STYLES } from './free-room-schemas'

describe('freeRoomCreateSchema', () => {
  it('accepts valid create input', () => {
    const result = freeRoomCreateSchema.safeParse({
      originalRoomId: 123,
      destinationRoomName: '#vi-team',
      kagiStyle: 'Clear',
      context: 'software team',
      protectedKeywords: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects context longer than 100 chars', () => {
    const result = freeRoomCreateSchema.safeParse({
      originalRoomId: 123,
      destinationRoomName: '#vi',
      kagiStyle: 'Clear',
      context: 'x'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid kagiStyle', () => {
    const result = freeRoomCreateSchema.safeParse({
      originalRoomId: 123,
      destinationRoomName: '#vi',
      kagiStyle: 'NotAStyle',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null context', () => {
    const result = freeRoomCreateSchema.safeParse({
      originalRoomId: 123,
      destinationRoomName: '#vi',
      kagiStyle: 'Wild',
      context: null,
    })
    expect(result.success).toBe(true)
  })
})

describe('KAGI_STYLES', () => {
  it('contains all 6 styles', () => {
    expect(KAGI_STYLES).toHaveLength(6)
    expect(KAGI_STYLES).toContain('Wild')
    expect(KAGI_STYLES).toContain('Clear')
    expect(KAGI_STYLES).toContain('True')
  })
})

describe('freeRoomEditSchema', () => {
  it('all fields optional', () => {
    const result = freeRoomEditSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/dashboard && bun test src/lib/free-room-schemas.test.ts
```

Expected: FAIL — `Cannot find module './free-room-schemas'`

- [ ] **Step 3: Implement free-room-schemas.ts**

Create `packages/dashboard/src/lib/free-room-schemas.ts`:

```typescript
import { z } from 'zod'

export const KAGI_STYLES = ['Wild', 'Easy', 'Clear', 'Smart', 'Fine', 'True'] as const

export type KagiStyle = (typeof KAGI_STYLES)[number]

export const KAGI_STYLE_LABELS: Record<KagiStyle, string> = {
  Wild: 'Wild — unfiltered casual',
  Easy: 'Easy — everyday casual',
  Clear: 'Clear — balanced default',
  Smart: 'Smart — professional',
  Fine: 'Fine — high formal',
  True: 'True — literal precise',
}

const keywordEntrySchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(100, 'Max 100 characters'),
  category: z.enum(['company', 'person', 'project', 'code', 'other'] as const),
  placeholder: z.string().max(50, 'Max 50 characters').optional(),
})

export type KeywordEntryFormInput = z.infer<typeof keywordEntrySchema>

export const freeRoomCreateSchema = z.object({
  originalRoomId: z
    .number({ required_error: 'Room ID is required' })
    .int('Room ID must be a whole number')
    .positive('Room ID must be positive'),
  destinationRoomName: z
    .string({ required_error: 'Destination room name is required' })
    .min(1, 'Destination room name is required')
    .max(100, 'Max 100 characters'),
  kagiStyle: z.enum(KAGI_STYLES, { required_error: 'Translation style is required' }),
  context: z.string().max(100, 'Max 100 characters').nullable().optional().default(null),
  protectedKeywords: z.array(keywordEntrySchema).max(50, 'Max 50 keywords').default([]),
})

export type FreeRoomCreateInput = z.infer<typeof freeRoomCreateSchema>

export const freeRoomEditSchema = z.object({
  destinationRoomName: z.string().min(1).max(100).optional(),
  kagiStyle: z.enum(KAGI_STYLES).optional(),
  context: z.string().max(100).nullable().optional(),
  protectedKeywords: z.array(keywordEntrySchema).max(50).default([]),
})

export type FreeRoomEditInput = z.infer<typeof freeRoomEditSchema>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/dashboard && bun test src/lib/free-room-schemas.test.ts
```

Expected: PASS — 6 tests

- [ ] **Step 5: Create free-room-api.ts**

Create `packages/dashboard/src/lib/free-room-api.ts`:

```typescript
import type { ApiResponse } from '~/lib/api-types'
import { ApiError } from '~/lib/api-client'
import type { FreeRoomCreateInput, FreeRoomEditInput } from './free-room-schemas'

export interface FreeRoom {
  id: string
  originalRoomId: number
  destinationRoomId: number
  destinationRoomName: string
  kagiStyle: string
  context: string | null
  protectedKeywords?: { keyword: string; category: string; placeholder?: string }[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

const BASE = '/api/free-rooms'

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(`${path}`, {
    method,
    ...(body !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  })

  if (response.status === 204) return { success: true } as ApiResponse<T>

  let json: ApiResponse<T>
  try {
    json = (await response.json()) as ApiResponse<T>
  } catch {
    throw new ApiError(`HTTP ${response.status.toString()}: non-JSON response`, response.status)
  }

  if (!response.ok) {
    throw new ApiError(json.error ?? `HTTP ${response.status.toString()}`, response.status)
  }

  return json
}

export const freeRoomApiClient = {
  listFreeRooms(): Promise<ApiResponse<FreeRoom[]>> {
    return request<FreeRoom[]>('GET', BASE)
  },

  getFreeRoom(id: string): Promise<ApiResponse<FreeRoom>> {
    return request<FreeRoom>('GET', `${BASE}/${id}`)
  },

  createFreeRoom(input: FreeRoomCreateInput): Promise<ApiResponse<FreeRoom>> {
    return request<FreeRoom>('POST', BASE, input)
  },

  updateFreeRoom(id: string, input: FreeRoomEditInput): Promise<ApiResponse<FreeRoom>> {
    return request<FreeRoom>('PUT', `${BASE}/${id}`, input)
  },

  deleteFreeRoom(id: string): Promise<ApiResponse<{ outcome: string }>> {
    return request<{ outcome: string }>('DELETE', `${BASE}/${id}`)
  },

  enableFreeRoom(id: string): Promise<ApiResponse<FreeRoom>> {
    return request<FreeRoom>('POST', `${BASE}/${id}/enable`)
  },

  disableFreeRoom(id: string): Promise<ApiResponse<FreeRoom>> {
    return request<FreeRoom>('POST', `${BASE}/${id}/disable`)
  },
}
```

- [ ] **Step 6: Create free-room-store.ts**

Create `packages/dashboard/src/stores/free-room-store.ts`:

```typescript
import { create } from 'zustand'
import { freeRoomApiClient, type FreeRoom } from '~/lib/free-room-api'
import { ApiError } from '~/lib/api-client'
import type { FreeRoomCreateInput, FreeRoomEditInput } from '~/lib/free-room-schemas'

type LoadState = 'idle' | 'loading' | 'success' | 'error'

interface FreeRoomStoreState {
  freeRooms: FreeRoom[]
  listState: LoadState
  listError: string | null
  actionError: string | null
  fetchFreeRooms: () => Promise<void>
  createFreeRoom: (input: FreeRoomCreateInput) => Promise<FreeRoom>
  updateFreeRoom: (id: string, input: FreeRoomEditInput) => Promise<FreeRoom>
  deleteFreeRoom: (id: string) => Promise<void>
  enableFreeRoom: (id: string) => Promise<void>
  disableFreeRoom: (id: string) => Promise<void>
  clearActionError: () => void
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function sortByCreatedAtDesc(rooms: FreeRoom[]): FreeRoom[] {
  return [...rooms].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

function upsertFreeRoom(rooms: FreeRoom[], next: FreeRoom): FreeRoom[] {
  const updated = rooms.some((r) => r.id === next.id)
    ? rooms.map((r) => (r.id === next.id ? next : r))
    : [...rooms, next]
  return sortByCreatedAtDesc(updated)
}

export const useFreeRoomStore = create<FreeRoomStoreState>()((set, get) => ({
  freeRooms: [],
  listState: 'idle',
  listError: null,
  actionError: null,

  fetchFreeRooms: async () => {
    set({ listState: 'loading', listError: null })
    try {
      const res = await freeRoomApiClient.listFreeRooms()
      set({ freeRooms: sortByCreatedAtDesc(res.data ?? []), listState: 'success' })
    } catch (error) {
      set({ listState: 'error', listError: getErrorMessage(error, 'Failed to load free rooms') })
    }
  },

  createFreeRoom: async (input) => {
    const res = await freeRoomApiClient.createFreeRoom(input)
    if (!res.data) throw new Error('No data in response')
    set((state) => ({ freeRooms: upsertFreeRoom(state.freeRooms, res.data!) }))
    return res.data
  },

  updateFreeRoom: async (id, input) => {
    const res = await freeRoomApiClient.updateFreeRoom(id, input)
    if (!res.data) throw new Error('No data in response')
    set((state) => ({ freeRooms: upsertFreeRoom(state.freeRooms, res.data!) }))
    return res.data
  },

  deleteFreeRoom: async (id) => {
    await freeRoomApiClient.deleteFreeRoom(id)
    set((state) => ({ freeRooms: state.freeRooms.filter((r) => r.id !== id) }))
  },

  enableFreeRoom: async (id) => {
    const res = await freeRoomApiClient.enableFreeRoom(id)
    if (res.data) {
      set((state) => ({ freeRooms: upsertFreeRoom(state.freeRooms, res.data!) }))
    }
  },

  disableFreeRoom: async (id) => {
    const res = await freeRoomApiClient.disableFreeRoom(id)
    if (res.data) {
      set((state) => ({ freeRooms: upsertFreeRoom(state.freeRooms, res.data!) }))
    }
  },

  clearActionError: () => set({ actionError: null }),
}))

export function selectFreeRooms(state: FreeRoomStoreState) {
  return state.freeRooms
}

export function selectCreateFreeRoom(state: FreeRoomStoreState) {
  return state.createFreeRoom
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/lib/free-room-schemas.ts \
        packages/dashboard/src/lib/free-room-schemas.test.ts \
        packages/dashboard/src/lib/free-room-api.ts \
        packages/dashboard/src/stores/free-room-store.ts
git commit -m "feat(dashboard): add free-room schemas, API client, and store"
```

---

## Task 8: dashboard — pages + router + sidebar

**Files:**

- Create: `packages/dashboard/src/pages/free-rooms.tsx`
- Create: `packages/dashboard/src/pages/free-room-create.tsx`
- Create: `packages/dashboard/src/pages/free-room-detail.tsx`
- Modify: `packages/dashboard/src/router.tsx`
- Modify: `packages/dashboard/src/layouts/app-layout.tsx`

- [ ] **Step 1: Create free-rooms.tsx (list page)**

Create `packages/dashboard/src/pages/free-rooms.tsx`:

```tsx
import { useEffect } from 'react'
import { Link } from 'react-router'
import { Icon } from '~/components/atoms/icons'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { PageShell } from '~/components/layout/page-shell'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { useFreeRoomStore, selectFreeRooms } from '~/stores/free-room-store'
import type { FreeRoom } from '~/lib/free-room-api'

function FreeRoomCard({ room }: { room: FreeRoom }) {
  const disableFreeRoom = useFreeRoomStore((s) => s.disableFreeRoom)
  const enableFreeRoom = useFreeRoomStore((s) => s.enableFreeRoom)

  return (
    <BrutalCard>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-heading text-lg font-bold truncate">
              {room.destinationRoomName}
            </span>
            <StickerLabel tone={room.enabled ? 'success' : 'warning'} tilt="flat">
              {room.enabled ? 'Active' : 'Paused'}
            </StickerLabel>
            <StickerLabel tone="neutral" tilt="flat">
              Free
            </StickerLabel>
          </div>
          <p className="text-sm opacity-60 mt-1">
            Room {room.originalRoomId.toString()} → {room.destinationRoomId.toString()} · Style:{' '}
            {room.kagiStyle}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="brutal-button theme-button-violet px-3 py-1.5 text-sm"
            onClick={() =>
              room.enabled ? void disableFreeRoom(room.id) : void enableFreeRoom(room.id)
            }
          >
            {room.enabled ? 'Pause' : 'Resume'}
          </button>
          <Link
            to={`/free-rooms/${room.id}`}
            className="brutal-button theme-button-sky px-3 py-1.5 text-sm"
          >
            Edit
          </Link>
        </div>
      </div>
    </BrutalCard>
  )
}

export function FreeRoomsPage() {
  const freeRooms = useFreeRoomStore(selectFreeRooms)
  const fetchFreeRooms = useFreeRoomStore((s) => s.fetchFreeRooms)
  const listState = useFreeRoomStore((s) => s.listState)

  useEffect(() => {
    void fetchFreeRooms()
  }, [fetchFreeRooms])

  return (
    <PageShell
      eyebrow="Free Translation"
      title="Free Rooms"
      description="Chatwork rooms translated via Kagi — no API key required."
      actions={
        <Link to="/free-rooms/new" className="brutal-button theme-button-success px-4 py-2">
          <Icon name="plus" variant="stroke" size={16} aria-hidden />
          Create Free Room
        </Link>
      }
    >
      {listState === 'loading' && <p className="opacity-50">Loading...</p>}
      {listState === 'error' && <p className="text-red-500">Failed to load free rooms.</p>}
      {listState === 'success' && freeRooms.length === 0 && (
        <p className="opacity-50">No free rooms yet. Create one to get started.</p>
      )}
      <div className="flex flex-col gap-4">
        {freeRooms.map((room) => (
          <FreeRoomCard key={room.id} room={room} />
        ))}
      </div>
    </PageShell>
  )
}
```

- [ ] **Step 2: Create free-room-create.tsx**

Create `packages/dashboard/src/pages/free-room-create.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { BrutalInput } from '~/components/atoms/brutal-input'
import { BrutalSelect } from '~/components/atoms/brutal-select'
import { ContextField } from '~/components/molecules/context-field'
import { KeywordProtectionField } from '~/components/molecules/keyword-protection-field'
import { PageShell } from '~/components/layout/page-shell'
import { useToast } from '~/components/organisms/toast-provider'
import { ApiError } from '~/lib/api-client'
import { KAGI_STYLES, KAGI_STYLE_LABELS, freeRoomCreateSchema } from '~/lib/free-room-schemas'
import type { FreeRoomCreateInput } from '~/lib/free-room-schemas'
import { useAsyncAction } from '~/hooks/use-async-action'
import { useFreeRoomStore, selectCreateFreeRoom } from '~/stores/free-room-store'
import type { FreeRoom } from '~/lib/free-room-api'

const styleOptions = KAGI_STYLES.map((s) => ({ value: s, label: KAGI_STYLE_LABELS[s] }))
const providerOptions = [{ value: 'free', label: 'Free ✓' }]

const resolver = zodResolver(freeRoomCreateSchema as never) as Resolver<FreeRoomCreateInput>

export function FreeRoomCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const createFreeRoom = useFreeRoomStore(selectCreateFreeRoom)
  const createAction = useAsyncAction<FreeRoom>({
    fallbackErrorMessage: 'Failed to create free room',
    getErrorMessage: (error) =>
      error instanceof ApiError ? error.message : 'Failed to create free room',
  })

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FreeRoomCreateInput>({
    resolver,
    defaultValues: {
      kagiStyle: 'Clear',
      destinationRoomName: '',
      context: '',
      protectedKeywords: [],
    } as FreeRoomCreateInput,
  })

  const onSubmit = handleSubmit(async (data) => {
    await createAction.run(
      async () => {
        const room = await createFreeRoom(data)
        toast({
          message: `"${room.destinationRoomName}" was created successfully`,
          tone: 'success',
        })
        void navigate('/free-rooms')
        return room
      },
      (message) => {
        setError('root', { message })
      },
    )
  })

  return (
    <PageShell
      eyebrow="Free Translation"
      title="Create Free Room"
      description="Set up a Kagi-powered translation room — no API key needed."
    >
      <BrutalCard>
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
          {/* Room IDs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BrutalInput
              label="Original Room ID *"
              type="number"
              placeholder="e.g. 123456789"
              error={errors.originalRoomId?.message}
              {...register('originalRoomId', { valueAsNumber: true })}
            />
            <BrutalInput
              label="Destination Room Name *"
              placeholder="e.g. #team-vi"
              error={errors.destinationRoomName?.message}
              {...register('destinationRoomName')}
            />
          </div>

          {/* Provider (disabled) + Style */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <BrutalSelect
                label="Provider"
                options={providerOptions}
                disabled
                defaultValue="free"
              />
              <p className="mt-1 text-xs opacity-40">Powered by Kagi Translate</p>
            </div>
            <BrutalSelect
              label="Translation Style *"
              options={styleOptions}
              error={errors.kagiStyle?.message}
              {...register('kagiStyle')}
            />
          </div>

          {/* No API key badge */}
          <div className="rounded-md border border-dashed border-green-500/30 bg-green-500/5 px-4 py-2 text-center text-sm text-green-400">
            ✓ No API key required — free to use
          </div>

          {/* Context */}
          <ContextField
            register={register}
            name="context"
            error={errors.context?.message}
            maxLength={100}
            hint="Sent to Kagi as a translation hint. Max 100 chars."
          />

          {/* Keywords */}
          <KeywordProtectionField
            getValue={() => getValues('protectedKeywords')}
            setValue={(keywords) => setValue('protectedKeywords', keywords)}
          />

          {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="brutal-button theme-button-success w-full py-3 font-bold"
          >
            {isSubmitting ? 'Creating...' : 'Create Free Room'}
          </button>
        </form>
      </BrutalCard>
    </PageShell>
  )
}
```

- [ ] **Step 3: Create free-room-detail.tsx (edit page)**

Create `packages/dashboard/src/pages/free-room-detail.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { BrutalInput } from '~/components/atoms/brutal-input'
import { BrutalSelect } from '~/components/atoms/brutal-select'
import { ContextField } from '~/components/molecules/context-field'
import { KeywordProtectionField } from '~/components/molecules/keyword-protection-field'
import { PageShell } from '~/components/layout/page-shell'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { useToast } from '~/components/organisms/toast-provider'
import { ApiError } from '~/lib/api-client'
import { KAGI_STYLES, KAGI_STYLE_LABELS, freeRoomEditSchema } from '~/lib/free-room-schemas'
import type { FreeRoomEditInput } from '~/lib/free-room-schemas'
import { useAsyncAction } from '~/hooks/use-async-action'
import { useFreeRoomStore } from '~/stores/free-room-store'
import type { FreeRoom } from '~/lib/free-room-api'

const styleOptions = KAGI_STYLES.map((s) => ({ value: s, label: KAGI_STYLE_LABELS[s] }))
const providerOptions = [{ value: 'free', label: 'Free ✓' }]

const resolver = zodResolver(freeRoomEditSchema as never) as Resolver<FreeRoomEditInput>

export function FreeRoomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const fetchFreeRooms = useFreeRoomStore((s) => s.fetchFreeRooms)
  const updateFreeRoom = useFreeRoomStore((s) => s.updateFreeRoom)
  const deleteFreeRoom = useFreeRoomStore((s) => s.deleteFreeRoom)
  const enableFreeRoom = useFreeRoomStore((s) => s.enableFreeRoom)
  const disableFreeRoom = useFreeRoomStore((s) => s.disableFreeRoom)
  const freeRooms = useFreeRoomStore((s) => s.freeRooms)
  const [room, setRoom] = useState<FreeRoom | null>(null)

  useEffect(() => {
    if (freeRooms.length === 0) void fetchFreeRooms()
  }, [freeRooms.length, fetchFreeRooms])

  useEffect(() => {
    const found = freeRooms.find((r) => r.id === id) ?? null
    setRoom(found)
  }, [freeRooms, id])

  const updateAction = useAsyncAction<FreeRoom>({
    fallbackErrorMessage: 'Failed to update free room',
    getErrorMessage: (error) =>
      error instanceof ApiError ? error.message : 'Failed to update free room',
  })

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FreeRoomEditInput>({ resolver })

  useEffect(() => {
    if (room) {
      reset({
        destinationRoomName: room.destinationRoomName,
        kagiStyle: room.kagiStyle as (typeof KAGI_STYLES)[number],
        context: room.context ?? '',
        protectedKeywords: room.protectedKeywords ?? [],
      })
    }
  }, [room, reset])

  if (!room) return <p className="p-8 opacity-50">Loading...</p>

  const onSubmit = handleSubmit(async (data) => {
    await updateAction.run(
      async () => {
        const updated = await updateFreeRoom(room.id, data)
        toast({ message: `"${updated.destinationRoomName}" was updated`, tone: 'success' })
        return updated
      },
      (msg) => toast({ message: msg, tone: 'error' }),
    )
  })

  const handleDelete = async () => {
    if (!confirm(`Delete "${room.destinationRoomName}"?`)) return
    await deleteFreeRoom(room.id)
    toast({ message: `"${room.destinationRoomName}" deleted`, tone: 'success' })
    void navigate('/free-rooms')
  }

  const handleToggleEnabled = async () => {
    if (room.enabled) {
      await disableFreeRoom(room.id)
      toast({ message: `"${room.destinationRoomName}" paused`, tone: 'success' })
    } else {
      await enableFreeRoom(room.id)
      toast({ message: `"${room.destinationRoomName}" resumed`, tone: 'success' })
    }
  }

  return (
    <PageShell
      eyebrow="Free Translation"
      title="Edit Free Room"
      description={`Editing ${room.destinationRoomName}`}
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            className="brutal-button theme-button-violet px-4 py-2"
            onClick={() => void handleToggleEnabled()}
          >
            {room.enabled ? 'Pause' : 'Resume'}
          </button>
          <button
            type="button"
            className="brutal-button theme-button-error px-4 py-2"
            onClick={() => void handleDelete()}
          >
            Delete
          </button>
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <StickerLabel tone={room.enabled ? 'success' : 'warning'} tilt="flat">
          {room.enabled ? 'Active' : 'Paused'}
        </StickerLabel>
        <StickerLabel tone="neutral" tilt="flat">
          Free
        </StickerLabel>
        <span className="text-sm opacity-50">
          Room {room.originalRoomId} → {room.destinationRoomId}
        </span>
      </div>

      <BrutalCard>
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BrutalInput
              label="Original Room ID"
              type="number"
              value={room.originalRoomId}
              disabled
            />
            <BrutalInput
              label="Destination Room Name *"
              placeholder="e.g. #team-vi"
              error={errors.destinationRoomName?.message}
              {...register('destinationRoomName')}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <BrutalSelect
                label="Provider"
                options={providerOptions}
                disabled
                defaultValue="free"
              />
              <p className="mt-1 text-xs opacity-40">Powered by Kagi Translate</p>
            </div>
            <BrutalSelect
              label="Translation Style *"
              options={styleOptions}
              error={errors.kagiStyle?.message}
              {...register('kagiStyle')}
            />
          </div>

          <div className="rounded-md border border-dashed border-green-500/30 bg-green-500/5 px-4 py-2 text-center text-sm text-green-400">
            ✓ No API key required — free to use
          </div>

          <ContextField
            register={register}
            name="context"
            error={errors.context?.message}
            maxLength={100}
            hint="Sent to Kagi as a translation hint. Max 100 chars."
          />

          <KeywordProtectionField
            getValue={() => getValues('protectedKeywords')}
            setValue={(keywords) => setValue('protectedKeywords', keywords)}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="brutal-button theme-button-success w-full py-3 font-bold"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </BrutalCard>
    </PageShell>
  )
}
```

- [ ] **Step 4: Update router.tsx**

In `packages/dashboard/src/router.tsx`, add imports and routes for the three free room pages.

The full updated file:

```typescript
import { createBrowserRouter } from 'react-router'
import { AppLayout } from '~/layouts/app-layout'
import { RoomListPage } from '~/pages/room-list'
import { RoomCreatePage } from '~/pages/room-create'
import { RoomDetailPage } from '~/pages/room-detail'
import { WebhookGuidePage } from '~/pages/webhook-guide'
import { FreeRoomsPage } from '~/pages/free-rooms'
import { FreeRoomCreatePage } from '~/pages/free-room-create'
import { FreeRoomDetailPage } from '~/pages/free-room-detail'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <RoomListPage /> },
      { path: '/rooms/new', element: <RoomCreatePage /> },
      { path: '/rooms/:id', element: <RoomDetailPage /> },
      { path: '/guide', element: <WebhookGuidePage /> },
      { path: '/free-rooms', element: <FreeRoomsPage /> },
      { path: '/free-rooms/new', element: <FreeRoomCreatePage /> },
      { path: '/free-rooms/:id', element: <FreeRoomDetailPage /> },
    ],
  },
])
```

- [ ] **Step 5: Update app-layout.tsx sidebar**

In `packages/dashboard/src/layouts/app-layout.tsx`, find the `navItems` array and add the free room items.

The `navItems` array currently ends with the `guide` item. Add new items after it:

```typescript
const navItems: readonly {
  to: string
  label: string
  surfaceClassName: string
  icon: ClayIconName | null
  section?: 'standard' | 'free'
}[] = [
  {
    to: '/',
    label: 'Dashboard',
    surfaceClassName: 'theme-card-matcha',
    icon: 'dashboard',
    section: 'standard',
  },
  {
    to: '/rooms/new',
    label: 'New Room',
    surfaceClassName: 'theme-card-blush',
    icon: 'plus',
    section: 'standard',
  },
  {
    to: '/guide',
    label: 'Webhook Guide',
    surfaceClassName: 'theme-card-sky',
    icon: 'book',
    section: 'standard',
  },
  {
    to: '/free-rooms',
    label: 'Free Rooms',
    surfaceClassName: 'theme-card-matcha',
    icon: 'dashboard',
    section: 'free',
  },
  {
    to: '/free-rooms/new',
    label: 'Create Free Room',
    surfaceClassName: 'theme-card-blush',
    icon: 'plus',
    section: 'free',
  },
]
```

In the nav rendering section of `app-layout.tsx`, find where `navItems.map(...)` is rendered and update it to render a divider between standard and free sections. Look for the pattern that maps `navItems` to `NavLink` elements and add a section divider before the first free item:

```tsx
{navItems.map((item, index) => (
  <>
    {item.section === 'free' && index > 0 && navItems[index - 1]?.section !== 'free' && (
      <div key="free-divider" className="mt-2 mb-1">
        <div className="h-px bg-white/10 mb-2" />
        <p className="px-2 text-xs uppercase tracking-widest opacity-40">Free</p>
      </div>
    )}
    <NavLink key={item.to} to={item.to} ...>
      ...
    </NavLink>
  </>
))}
```

Note: The exact rendering pattern must match what the existing `app-layout.tsx` uses. Read the full file and follow the same `NavLink` structure — only add the divider logic, do not change how individual nav items are rendered.

- [ ] **Step 6: Run typecheck**

```bash
cd packages/dashboard && bun run typecheck
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add packages/dashboard/src/pages/free-rooms.tsx \
        packages/dashboard/src/pages/free-room-create.tsx \
        packages/dashboard/src/pages/free-room-detail.tsx \
        packages/dashboard/src/router.tsx \
        packages/dashboard/src/layouts/app-layout.tsx
git commit -m "feat(dashboard): add Free Rooms pages, router routes, and sidebar section"
```

---

## Task 9: Docker infrastructure

**Files:**

- Create: `Dockerfile.kagi`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`

- [ ] **Step 1: Create Dockerfile.kagi**

Create `Dockerfile.kagi` in the project root:

```dockerfile
# Stage 1: Build with Bun
FROM oven/bun:1.3-alpine AS builder
WORKDIR /app

# Copy workspace manifests and root config
COPY package.json bun.lock* tsconfig.base.json ./
COPY packages/kagi-sidecar/package.json ./packages/kagi-sidecar/
RUN bun install --frozen-lockfile

# Copy source
COPY packages/kagi-sidecar/ ./packages/kagi-sidecar/
COPY tsconfig.base.json ./

# Bundle to a single file
RUN bun build packages/kagi-sidecar/src/index.ts \
      --outfile dist/kagi.js \
      --target bun \
      --minify

# Stage 2: Runtime with Chromium
FROM zenika/alpine-chrome:with-node AS runtime
WORKDIR /app

# Install bun in the runtime image
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

COPY --from=builder /app/dist/kagi.js ./kagi.js

ENV NODE_ENV=production
ENV KAGI_PORT=3002
EXPOSE 3002

CMD ["bun", "run", "kagi.js"]
```

- [ ] **Step 2: Add kagi-translator service to docker-compose.yml**

In `docker-compose.yml`, add this service before the `networks:` block:

```yaml
kagi-translator:
  build:
    context: .
    dockerfile: Dockerfile.kagi
  env_file: [.env]
  ports:
    - '${KAGI_PORT:-3002}:3002'
  restart: unless-stopped
  networks: [chatwork-net]
  healthcheck:
    test: ['CMD', 'wget', '-qO-', 'http://localhost:3002/health']
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s
```

Also update the `translator` service to add `KAGI_TRANSLATOR_URL` to its environment and depend on `kagi-translator`:

```yaml
  translator:
    ...
    environment:
      ROOM_CONFIG_ENCRYPTION_KEY: ${ROOM_CONFIG_ENCRYPTION_KEY}
      KAGI_TRANSLATOR_URL: http://kagi-translator:3002   # add this
    depends_on:
      kagi-translator:
        condition: service_healthy
```

- [ ] **Step 3: Add kagi-translator service to docker-compose.dev.yml**

In `docker-compose.dev.yml`, add this service (similar pattern to the dev translator service):

```yaml
kagi-translator:
  image: zenika/alpine-chrome:with-node
  dns:
    - 1.1.1.1
    - 8.8.8.8
  sysctls:
    - net.ipv6.conf.all.disable_ipv6=1
  command:
    - sh
    - -c
    - curl -fsSL https://bun.sh/install | bash && export PATH="/root/.bun/bin:$PATH" && bun install && bun --hot packages/kagi-sidecar/src/index.ts
  working_dir: /app
  volumes:
    - .:/app
    - node_modules:/app/node_modules
    - bun_cache:/root/.bun/install/cache
  environment:
    - HUSKY=0
    - BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache
    - KAGI_PORT=3002
  ports:
    - '${KAGI_PORT:-3002}:3002'
  tty: true
  networks: [chatwork-net]
  healthcheck:
    test: ['CMD', 'wget', '-qO-', 'http://localhost:3002/health']
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 120s
```

Also add to the `translator` service in `docker-compose.dev.yml`:

```yaml
environment: ...
  - KAGI_TRANSLATOR_URL=http://kagi-translator:3002
depends_on:
  kagi-translator:
    condition: service_healthy
```

- [ ] **Step 4: Run final full test suite**

```bash
bun test && bun run typecheck && bun run lint
```

Expected: all green

- [ ] **Step 5: Commit**

```bash
git add Dockerfile.kagi docker-compose.yml docker-compose.dev.yml
git commit -m "feat(repo): add Dockerfile.kagi and kagi-translator service to docker-compose"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `bun test` passes — all new tests green, existing tests unchanged
- [ ] `bun run typecheck` passes — no TS errors
- [ ] `bun run lint` passes — no lint errors
- [ ] `packages/kagi-sidecar/src/url-builder.test.ts` — 9 tests covering all 6 styles + context
- [ ] `packages/provider-kagi/src/kagi-client.test.ts` — 5 tests covering happy path + error paths
- [ ] `packages/translator/src/services/free-room-config-store.test.ts` — 11 tests covering full CRUD
- [ ] `packages/translator/src/webhook/free-handler.test.ts` — 4 tests covering room-not-found, disabled, translate+send, error swallow
- [ ] `packages/dashboard/src/lib/free-room-schemas.test.ts` — 6 tests validating Zod schemas
- [ ] `data/room-configs.json` is NEVER read or written by any new code
- [ ] `handleTranslateRequest` and `RoomConfigStore` are NEVER imported in new files
- [ ] All new API routes respond with `{ success: true, data: ... }` shape
- [ ] All new logs include `roomType: 'free'`
