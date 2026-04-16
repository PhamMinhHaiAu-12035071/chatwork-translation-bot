# Batch Message Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend single-message translation to multi-message batch translation from JSON file input

**Architecture:** Sequential batch orchestrator that reuses browser session, manages tab lifecycle (reuse tab[0], open+close for tab[1]+), fail-fast error policy, console-only output

**Tech Stack:** Bun, TypeScript, Patchright (Playwright), dependency injection with interfaces, TDD with colocated tests

---

## Task 1: Add INPUT_FILE configuration constants

**Files:**

- Modify: `nghien_cuu_cua_toi/src/config/translation.config.ts`
- Test: `nghien_cuu_cua_toi/src/config/translation.config.test.ts`

- [ ] **Step 1: Write failing tests for INPUT_FILE constants**

```typescript
// Add to nghien_cuu_cua_toi/src/config/translation.config.test.ts

describe('Batch translation configuration', () => {
  it('INPUT_FILE_ENV should be defined', () => {
    expect(INPUT_FILE_ENV).toBe('INPUT_FILE')
  })

  it('INPUT_FILE_DEFAULT_PATH should point to inputs/messages.json', () => {
    expect(INPUT_FILE_DEFAULT_PATH).toBe('inputs/messages.json')
  })

  it('INPUT_FILE_DOCKER_PATH should point to /app/inputs/messages.json', () => {
    expect(INPUT_FILE_DOCKER_PATH).toBe('/app/inputs/messages.json')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/config/translation.config.test.ts`
Expected: FAIL with "INPUT_FILE_ENV is not defined"

- [ ] **Step 3: Add INPUT_FILE constants to translation.config.ts**

```typescript
// Add after KAGI_SESSION_FILE_NAME constant in nghien_cuu_cua_toi/src/config/translation.config.ts

/**
 * Env var to override default input file path for batch translation
 */
export const INPUT_FILE_ENV = 'INPUT_FILE' as const

/**
 * Default input file path for batch translation (local development)
 */
export const INPUT_FILE_DEFAULT_PATH = 'inputs/messages.json' as const

/**
 * Docker container input file path for batch translation
 */
export const INPUT_FILE_DOCKER_PATH = '/app/inputs/messages.json' as const
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/config/translation.config.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/config/translation.config.ts src/config/translation.config.test.ts
git commit -m "feat: add INPUT_FILE configuration constants for batch translation"
```

---

## Task 2: Add openNewTab() method to browser interface

**Files:**

- Modify: `nghien_cuu_cua_toi/src/services/interfaces/browser.interface.ts:41-80`

- [ ] **Step 1: Add openNewTab() method signature to IBrowserService interface**

```typescript
// Add after setupSession?() method in nghien_cuu_cua_toi/src/services/interfaces/browser.interface.ts

/**
 * Opens a new browser tab within the existing context.
 * Used for batch translation to isolate each message in a clean tab.
 * @returns Promise resolving when new page is ready
 * @throws {BrowserAutomationError} If tab creation fails
 */
openNewTab?(): Promise<void>
```

- [ ] **Step 2: Run typecheck to verify interface change**

Run: `bun run typecheck`
Expected: No errors (method is optional, existing implementations still valid)

- [ ] **Step 3: Commit interface change**

```bash
git add src/services/interfaces/browser.interface.ts
git commit -m "feat: add openNewTab() method to IBrowserService interface"
```

---

## Task 3: Implement openNewTab() in KagiBrowserService

**Files:**

- Modify: `nghien_cuu_cua_toi/src/services/browser.service.ts`
- Test: `nghien_cuu_cua_toi/src/services/browser.service.test.ts`

- [ ] **Step 1: Write failing test for openNewTab()**

```typescript
// Add to nghien_cuu_cua_toi/src/services/browser.service.test.ts

describe('openNewTab', () => {
  it('should create a new page and update internal page reference', async () => {
    const service = new KagiBrowserService()
    await service.launch()

    const originalPage = service['connection']?.getPage()
    await service.openNewTab()
    const newPage = service['connection']?.getPage()

    expect(newPage).not.toBe(originalPage)
    expect(newPage).toBeDefined()

    await service.close()
  })

  it('should throw error if called before launch', async () => {
    const service = new KagiBrowserService()

    expect(async () => {
      await service.openNewTab()
    }).toThrow('Browser not launched')
  })

  it('should close previous page when opening new tab', async () => {
    const service = new KagiBrowserService()
    await service.launch()

    const firstPage = service['connection']?.getPage()
    const closeSpyFirstPage = mock.spyOn(firstPage!, 'close')

    await service.openNewTab()

    expect(closeSpyFirstPage).toHaveBeenCalledTimes(1)

    await service.close()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/services/browser.service.test.ts -t "openNewTab"`
Expected: FAIL with "openNewTab is not a function"

- [ ] **Step 3: Implement openNewTab() method**

```typescript
// Add after setupSession() method in nghien_cuu_cua_toi/src/services/browser.service.ts

/**
 * Opens a new browser tab and closes the previous one.
 * Used for batch translation to ensure each message runs in a clean tab state.
 * Updates the internal page reference to the new tab.
 * @throws {BrowserAutomationError} If browser not launched or tab creation fails
 */
async openNewTab(): Promise<void> {
  if (this.connection === null) {
    throw new BrowserAutomationError({
      message: 'Browser not launched. Call launch() first.',
      phase: 'open-new-tab',
      url: 'N/A',
    })
  }

  const context = this.connection.getContext()
  if (context === undefined) {
    throw new BrowserAutomationError({
      message: 'Browser context not available',
      phase: 'open-new-tab',
      url: 'N/A',
    })
  }

  const oldPage = this.connection.getPage()
  const newPage = await context.newPage()

  // Update connection to use new page
  this.connection = new BrowserConnection(context, newPage)

  // Close old page to free resources
  await oldPage.close()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/services/browser.service.test.ts -t "openNewTab"`
Expected: PASS

- [ ] **Step 5: Run full test suite for browser service**

Run: `bun test src/services/browser.service.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/services/browser.service.ts src/services/browser.service.test.ts
git commit -m "feat: implement openNewTab() in KagiBrowserService"
```

---

## Task 4: Create batch translation service with tests (TDD)

**Files:**

- Create: `nghien_cuu_cua_toi/src/services/batch-translation.service.ts`
- Create: `nghien_cuu_cua_toi/src/services/batch-translation.service.test.ts`

- [ ] **Step 1: Create test file with comprehensive test cases**

```typescript
// nghien_cuu_cua_toi/src/services/batch-translation.service.test.ts

import { describe, expect, it, mock } from 'bun:test'
import type { IUrlBuilder } from './interfaces/url-builder.interface'
import type { IBrowserService } from './interfaces/browser.interface'
import { runBatchTranslation } from './batch-translation.service'
import { getDefaultTranslationOptions } from '~/config'

describe('runBatchTranslation', () => {
  it('should translate all messages sequentially with correct tab lifecycle', async () => {
    const messages = ['Message 1', 'Message 2', 'Message 3']
    const translatedMessages: string[] = []
    const openNewTabCalls: number[] = []
    let translateCallCount = 0

    const urlBuilder: IUrlBuilder = {
      build: mock((text: string) => `url-${text}`),
      buildNavigation: mock(() => 'nav-url'),
    }

    const browserService: IBrowserService = {
      launch: mock(async () => ({ close: mock(async () => {}) })),
      setupSession: mock(async () => {}),
      openNewTab: mock(async () => {
        openNewTabCalls.push(translateCallCount)
      }),
      translate: mock(async (_url: string, _options, sourceText?: string) => {
        translateCallCount++
        const result = `translated-${sourceText}`
        translatedMessages.push(result)
        return {
          translated: result,
          finalUrl: `https://example.com/${sourceText}`,
        }
      }),
      close: mock(async () => {}),
    }

    const results = await runBatchTranslation(messages, getDefaultTranslationOptions(), {
      urlBuilder,
      browserService,
      log: () => {},
    })

    // Verify all messages translated
    expect(translatedMessages).toEqual([
      'translated-Message 1',
      'translated-Message 2',
      'translated-Message 3',
    ])

    // Verify results structure
    expect(results.length).toBe(3)
    expect(results[0].index).toBe(0)
    expect(results[0].original).toBe('Message 1')
    expect(results[1].index).toBe(1)
    expect(results[2].index).toBe(2)

    // Verify openNewTab called before item[1] and item[2] (not item[0])
    expect(openNewTabCalls).toEqual([1, 2]) // Called after translate 1 and 2, before 2 and 3

    // Verify setupSession called once
    expect(browserService.setupSession).toHaveBeenCalledTimes(1)

    // Verify launch and close called once each
    expect(browserService.launch).toHaveBeenCalledTimes(1)
    expect(browserService.close).toHaveBeenCalledTimes(1)
  })

  it('should handle single message without opening new tab', async () => {
    const messages = ['Single message']

    const urlBuilder: IUrlBuilder = {
      build: mock(() => 'url'),
      buildNavigation: mock(() => 'nav-url'),
    }

    const browserService: IBrowserService = {
      launch: mock(async () => ({ close: mock(async () => {}) })),
      setupSession: mock(async () => {}),
      openNewTab: mock(async () => {}),
      translate: mock(async () => ({
        translated: 'translated-single',
        finalUrl: 'https://example.com/single',
      })),
      close: mock(async () => {}),
    }

    const results = await runBatchTranslation(messages, getDefaultTranslationOptions(), {
      urlBuilder,
      browserService,
    })

    expect(results.length).toBe(1)
    expect(browserService.openNewTab).not.toHaveBeenCalled()
  })

  it('should abort and close browser on first translation error', async () => {
    const messages = ['Message 1', 'Message 2', 'Message 3']

    const urlBuilder: IUrlBuilder = {
      build: mock(() => 'url'),
      buildNavigation: mock(() => 'nav-url'),
    }

    const browserService: IBrowserService = {
      launch: mock(async () => ({ close: mock(async () => {}) })),
      setupSession: mock(async () => {}),
      openNewTab: mock(async () => {}),
      translate: mock(async (_url, _options, sourceText?: string) => {
        if (sourceText === 'Message 2') {
          throw new Error('Translation failed for Message 2')
        }
        return {
          translated: `translated-${sourceText}`,
          finalUrl: 'https://example.com',
        }
      }),
      close: mock(async () => {}),
    }

    await expect(async () => {
      await runBatchTranslation(messages, getDefaultTranslationOptions(), {
        urlBuilder,
        browserService,
      })
    }).toThrow('Translation failed for Message 2')

    // Verify browser was closed despite error
    expect(browserService.close).toHaveBeenCalledTimes(1)
  })

  it('should log progress messages for each item', async () => {
    const messages = ['A', 'B']
    const logMessages: string[] = []

    const urlBuilder: IUrlBuilder = {
      build: mock(() => 'url'),
      buildNavigation: mock(() => 'nav-url'),
    }

    const browserService: IBrowserService = {
      launch: mock(async () => ({ close: mock(async () => {}) })),
      setupSession: mock(async () => {}),
      openNewTab: mock(async () => {}),
      translate: mock(async () => ({
        translated: 'result',
        finalUrl: 'https://example.com',
      })),
      close: mock(async () => {}),
    }

    await runBatchTranslation(messages, getDefaultTranslationOptions(), {
      urlBuilder,
      browserService,
      log: (msg: string) => {
        logMessages.push(msg)
      },
    })

    expect(logMessages.some((msg) => msg.includes('1/2'))).toBe(true)
    expect(logMessages.some((msg) => msg.includes('2/2'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/services/batch-translation.service.test.ts`
Expected: FAIL with "Cannot find module './batch-translation.service'"

- [ ] **Step 3: Create minimal batch-translation.service.ts implementation**

```typescript
// nghien_cuu_cua_toi/src/services/batch-translation.service.ts

import type { IBrowserService } from './interfaces/browser.interface'
import type { IUrlBuilder } from './interfaces/url-builder.interface'
import type { TranslationOptions } from '~/types'

export interface BatchTranslationResult {
  index: number
  original: string
  translated: string
  finalUrl: string
}

export interface BatchTranslationDeps {
  browserService: IBrowserService
  urlBuilder: IUrlBuilder
  log?: (message: string) => void
}

/**
 * Runs batch translation for an array of messages.
 *
 * Flow:
 * 1. Launch browser and setup session once
 * 2. Item[0]: translate in current tab (from setupSession)
 * 3. Item[i>0]: openNewTab() → translate → (prev tab auto-closed by openNewTab)
 * 4. Close browser after all items complete
 *
 * Error policy: Fail-fast — abort entire batch on first error
 *
 * @param messages - Array of text strings to translate
 * @param options - Translation options (global, applied to all messages)
 * @param deps - Dependencies (browserService, urlBuilder, optional log)
 * @returns Array of translation results with index and metadata
 * @throws Error if any translation fails (browser closed in finally block)
 */
export async function runBatchTranslation(
  messages: string[],
  options: TranslationOptions,
  deps: BatchTranslationDeps,
): Promise<BatchTranslationResult[]> {
  const { browserService, urlBuilder, log } = deps
  const results: BatchTranslationResult[] = []

  await browserService.launch()

  try {
    // Setup session once (navigate, inject cookies, verify login)
    await browserService.setupSession?.()

    for (const [index, message] of messages.entries()) {
      log?.(`\n🔁 Message ${index + 1}/${messages.length}`)

      // Item[0]: reuse current tab; Item[i>0]: open new tab (closes previous)
      if (index > 0) {
        await browserService.openNewTab?.()
      }

      const url = urlBuilder.buildNavigation(options)
      const { translated, finalUrl } = await browserService.translate(url, options, message)

      results.push({
        index,
        original: message,
        translated,
        finalUrl,
      })

      log?.(`Final translation output: ${translated}`)
    }

    return results
  } finally {
    await browserService.close()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/services/batch-translation.service.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/services/batch-translation.service.ts src/services/batch-translation.service.test.ts
git commit -m "feat: implement runBatchTranslation service with TDD"
```

---

## Task 5: Add input file reading and validation logic

**Files:**

- Modify: `nghien_cuu_cua_toi/src/index.ts`

- [ ] **Step 1: Write test for readInputFile function**

```typescript
// Add to nghien_cuu_cua_toi/src/index.test.ts (create if doesn't exist)

import { describe, expect, it } from 'bun:test'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { readInputFile } from './index'

describe('readInputFile', () => {
  const testFilePath = 'test-input.json'

  afterEach(() => {
    try {
      unlinkSync(testFilePath)
    } catch {
      // File may not exist
    }
  })

  it('should read and parse valid JSON array', () => {
    writeFileSync(testFilePath, JSON.stringify(['msg1', 'msg2', 'msg3']))
    const result = readInputFile(testFilePath)
    expect(result).toEqual(['msg1', 'msg2', 'msg3'])
  })

  it('should throw error with guidance if file does not exist', () => {
    expect(() => {
      readInputFile('nonexistent.json')
    }).toThrow(/Input file not found/)
  })

  it('should throw error if file is not valid JSON', () => {
    writeFileSync(testFilePath, 'invalid json {')
    expect(() => {
      readInputFile(testFilePath)
    }).toThrow(/Failed to parse/)
  })

  it('should throw error if JSON is not an array', () => {
    writeFileSync(testFilePath, JSON.stringify({ messages: ['a'] }))
    expect(() => {
      readInputFile(testFilePath)
    }).toThrow(/must be an array/)
  })

  it('should throw error if array is empty', () => {
    writeFileSync(testFilePath, JSON.stringify([]))
    expect(() => {
      readInputFile(testFilePath)
    }).toThrow(/at least 1 message/)
  })

  it('should throw error if array contains non-string', () => {
    writeFileSync(testFilePath, JSON.stringify(['valid', 42, 'also valid']))
    expect(() => {
      readInputFile(testFilePath)
    }).toThrow(/index 1.*must be a string/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/index.test.ts -t "readInputFile"`
Expected: FAIL with "readInputFile is not exported"

- [ ] **Step 3: Implement readInputFile function**

```typescript
// Add to nghien_cuu_cua_toi/src/index.ts (before main function)

import { existsSync, readFileSync } from 'node:fs'
import type { IUrlBuilder } from '~/services/interfaces/url-builder.interface'
import type { IBrowserService } from '~/services/interfaces/browser.interface'
import { KagiUrlBuilder } from '~/services/url-builder.service'
import { KagiBrowserService } from '~/services/browser.service'
import { runBatchTranslation } from '~/services/batch-translation.service'
import {
  BROWSER_CONFIG,
  DEFAULT_TRANSLATION_CONFIG,
  INPUT_FILE_ENV,
  INPUT_FILE_DEFAULT_PATH,
  INPUT_FILE_DOCKER_PATH,
  clampTranslationContext,
  clampInputText,
  getDefaultTranslationOptions,
} from '~/config/translation.config'

/**
 * Reads and validates input file for batch translation.
 * @param filePath - Path to JSON file containing array of messages
 * @returns Array of message strings
 * @throws Error with guidance if file invalid or missing
 */
export function readInputFile(filePath: string): string[] {
  // Check file exists
  if (!existsSync(filePath)) {
    throw new Error(
      `Input file not found: ${filePath}\n\n` +
        `Create the file with this format:\n` +
        `[\n` +
        `  "Message 1 to translate...",\n` +
        `  "Message 2 to translate..."\n` +
        `]\n\n` +
        `Or override the path:\n` +
        `  INPUT_FILE=./my-batch.json bun run start:local`,
    )
  }

  // Read and parse JSON
  let parsed: unknown
  try {
    const content = readFileSync(filePath, 'utf-8')
    parsed = JSON.parse(content)
  } catch (error) {
    throw new Error(
      `Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  // Validate is array
  if (!Array.isArray(parsed)) {
    throw new Error(`Input file ${filePath} must be an array of strings, got: ${typeof parsed}`)
  }

  // Validate not empty
  if (parsed.length === 0) {
    throw new Error(`Input file ${filePath} must contain at least 1 message`)
  }

  // Validate all items are strings
  for (const [index, item] of parsed.entries()) {
    if (typeof item !== 'string') {
      throw new Error(
        `Input file ${filePath} item at index ${index} must be a string, got: ${typeof item}`,
      )
    }
  }

  return parsed
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/index.test.ts -t "readInputFile"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "feat: add readInputFile with validation and error guidance"
```

---

## Task 6: Update main() function to use batch translation

**Files:**

- Modify: `nghien_cuu_cua_toi/src/index.ts:34-105`

- [ ] **Step 1: Replace main() function implementation**

```typescript
// Replace existing main() function in nghien_cuu_cua_toi/src/index.ts

/**
 * Main batch translation workflow
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║      🌐 KAGI BATCH TRANSLATE AUTOMATION                   ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // Resolve input file path
  const isDocker = process.env.NODE_ENV === 'production'
  const defaultPath = isDocker ? INPUT_FILE_DOCKER_PATH : INPUT_FILE_DEFAULT_PATH
  const inputFilePath = process.env[INPUT_FILE_ENV] ?? defaultPath

  console.log(`📁 Input file: ${inputFilePath}\n`)

  // Read and validate messages
  let messages: string[]
  try {
    messages = readInputFile(inputFilePath)
  } catch (error) {
    console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  // Clamp each message to max length
  const clampedMessages = messages.map((msg) => clampInputText(msg))

  console.log(`✅ Loaded ${messages.length} message(s) from ${inputFilePath}`)

  // Load translation options
  const options = getDefaultTranslationOptions()
  options.translationContext =
    process.env.TRANSLATION_CONTEXT !== undefined
      ? clampTranslationContext(process.env.TRANSLATION_CONTEXT)
      : ''

  console.log(`🌍 ${options.sourceLang} → ${options.targetLang}`)
  console.log('⚙️  Translation preset:')
  console.log(`    Style: ${options.style}`)
  console.log(`    Formality: ${options.formality}`)
  console.log(`    Reading Level: ${options.readingLevel}`)
  console.log(`    Speaker: ${options.speakerGender}`)
  console.log(`    Addressee: ${options.addresseeGender}`)
  console.log(
    `    Context: ${options.translationContext === '' ? '(none)' : `"${options.translationContext}"`}\n`,
  )

  // Initialize services
  const urlBuilder: IUrlBuilder = new KagiUrlBuilder()
  const browserService: IBrowserService = new KagiBrowserService()

  try {
    console.log(`🚀 Launching batch translation (${messages.length} messages)...\n`)

    const results = await runBatchTranslation(clampedMessages, options, {
      urlBuilder,
      browserService,
      log: (message: string) => {
        console.log(message)
      },
    })

    // Print results
    const divider = '─'.repeat(60)
    console.log(`\n✅ BATCH COMPLETE: ${results.length}/${messages.length} messages translated\n`)

    for (const result of results) {
      console.log(divider)
      console.log(`📝 Message ${result.index + 1}/${results.length}`)
      console.log(`📝 Original: ${result.original}`)
      console.log(`📝 Translated: ${result.translated}`)
      console.log(`🔗 Final URL: ${result.finalUrl}`)
    }
    console.log(divider)
  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

- [ ] **Step 3: Update imports at top of index.ts**

Verify these imports are present:

```typescript
import { existsSync, readFileSync } from 'node:fs'
import type { IUrlBuilder } from '~/services/interfaces/url-builder.interface'
import type { IBrowserService } from '~/services/interfaces/browser.interface'
import { KagiUrlBuilder } from '~/services/url-builder.service'
import { KagiBrowserService } from '~/services/browser.service'
import { runBatchTranslation } from '~/services/batch-translation.service'
import {
  INPUT_FILE_ENV,
  INPUT_FILE_DEFAULT_PATH,
  INPUT_FILE_DOCKER_PATH,
  getDefaultTranslationOptions,
  clampInputText,
  clampTranslationContext,
} from '~/config/translation.config'
```

- [ ] **Step 4: Remove old runReadingLevelSweep import**

Remove this line if present:

```typescript
import { runReadingLevelSweep } from '~/services/reading-level-sweep.service'
```

- [ ] **Step 5: Run lint**

Run: `bun run lint`
Expected: No errors (or auto-fix any unused imports)

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat: replace single-message with batch translation in main()"
```

---

## Task 7: Create sample input file

**Files:**

- Create: `nghien_cuu_cua_toi/inputs/messages.json.example`

- [ ] **Step 1: Create inputs directory if not exists**

Run: `mkdir -p nghien_cuu_cua_toi/inputs`

- [ ] **Step 2: Create example input file**

```json
[
  "動画を一定時間（例：10秒ごと）のチャンクに分割し、複数のGPUインスタンスで並列処理することで、1時間の動画でも数分で解析を終えることが可能です。",
  "2. 圧縮技術による最適化\n「AIが物体を検出できる最低限の画質」まで落として転送するエンコード処理",
  "プロキシ動画の生成:\n4KやフルHDで撮影しても、AI検出用には 640x360（nHD） 程度まで解像度を落とした軽量なプロキシ動画に変換し、クラウドへ送る"
]
```

Write to: `nghien_cuu_cua_toi/inputs/messages.json.example`

- [ ] **Step 3: Verify file is valid JSON**

Run: `bun -e "console.log(JSON.parse(require('fs').readFileSync('nghien_cuu_cua_toi/inputs/messages.json.example', 'utf-8')))"`
Expected: Array printed without errors

- [ ] **Step 4: Commit**

```bash
git add inputs/messages.json.example
git commit -m "docs: add sample input file for batch translation"
```

---

## Task 8: Update .gitignore to exclude inputs/

**Files:**

- Modify: `nghien_cuu_cua_toi/.gitignore`

- [ ] **Step 1: Add inputs/ exclusion to .gitignore**

```gitignore
# Add to nghien_cuu_cua_toi/.gitignore

# Input messages (may contain sensitive content)
inputs/
!inputs/*.example.json
```

- [ ] **Step 2: Verify .gitignore works**

Run: `git status`
Expected: `inputs/messages.json.example` should appear as untracked (will be added), but `inputs/` directory itself should not appear if empty files are created inside

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: exclude inputs/ directory from git (except .example files)"
```

---

## Task 9: Update docker-compose.yml with inputs volume

**Files:**

- Modify: `nghien_cuu_cua_toi/docker-compose.yml`

- [ ] **Step 1: Read current docker-compose.yml**

Run: `cat nghien_cuu_cua_toi/docker-compose.yml`

- [ ] **Step 2: Add inputs volume mount**

Find the `volumes:` section and add the new mount:

```yaml
# In nghien_cuu_cua_toi/docker-compose.yml
volumes:
  - ./secrets:/app/secrets
  - ./inputs:/app/inputs # Add this line
```

- [ ] **Step 3: Verify YAML is valid**

Run: `docker-compose -f nghien_cuu_cua_toi/docker-compose.yml config`
Expected: Valid YAML output without errors

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add inputs volume mount to docker-compose"
```

---

## Task 10: Integration test - Manual verification

**Files:**

- Test: Manual execution of the full workflow

- [ ] **Step 1: Create test input file**

```bash
cat > nghien_cuu_cua_toi/inputs/messages.json << 'EOF'
[
  "Hello world",
  "Good morning"
]
EOF
```

- [ ] **Step 2: Run batch translation locally**

Run: `cd nghien_cuu_cua_toi && bun run src/index.ts`
Expected:

- Browser launches
- Session setup (login verification)
- Message 1/2 translates in current tab
- New tab opens, Message 2/2 translates
- Browser closes
- Console shows both results

- [ ] **Step 3: Verify error handling - missing file**

Run: `cd nghien_cuu_cua_toi && INPUT_FILE=./nonexistent.json bun run src/index.ts`
Expected:

- Error message: "Input file not found: ./nonexistent.json"
- Guidance message with example JSON format
- Exit code 1 (check with `echo $?`)

- [ ] **Step 4: Verify error handling - invalid JSON**

```bash
echo "not valid json" > nghien_cuu_cua_toi/inputs/invalid.json
cd nghien_cuu_cua_toi && INPUT_FILE=./inputs/invalid.json bun run src/index.ts
```

Expected:

- Error message: "Failed to parse"
- Exit code 1

- [ ] **Step 5: Verify error handling - empty array**

```bash
echo "[]" > nghien_cuu_cua_toi/inputs/empty.json
cd nghien_cuu_cua_toi && INPUT_FILE=./inputs/empty.json bun run src/index.ts
```

Expected:

- Error message: "must contain at least 1 message"
- Exit code 1

- [ ] **Step 6: Clean up test files**

```bash
rm nghien_cuu_cua_toi/inputs/invalid.json
rm nghien_cuu_cua_toi/inputs/empty.json
```

- [ ] **Step 7: Run full test suite**

Run: `cd nghien_cuu_cua_toi && bun test`
Expected: All tests PASS

- [ ] **Step 8: Run typecheck**

Run: `cd nghien_cuu_cua_toi && bun run typecheck`
Expected: No errors

- [ ] **Step 9: Run lint**

Run: `cd nghien_cuu_cua_toi && bun run lint`
Expected: No errors

- [ ] **Step 10: Final commit**

```bash
git add .
git commit -m "test: verify batch translation integration works end-to-end"
```

---

## Task 11: Update README with batch translation usage

**Files:**

- Modify: `README.md` (or `nghien_cuu_cua_toi/README.md` if it exists)

- [ ] **Step 1: Add batch translation section to README**

````markdown
## Batch Translation

Translate multiple messages from a JSON file:

### Local Development

1. Create input file:

```bash
cat > nghien_cuu_cua_toi/inputs/messages.json << 'EOF'
[
  "First message to translate",
  "Second message to translate",
  "Third message to translate"
]
EOF
```
````

2. Run batch translation:

```bash
cd nghien_cuu_cua_toi
bun run src/index.ts
```

### Docker

1. Create `inputs/messages.json` in project root
2. Run with docker-compose:

```bash
docker-compose -f nghien_cuu_cua_toi/docker-compose.yml up
```

### Configuration

- **Input file path**: Set `INPUT_FILE` env var to override default (`inputs/messages.json`)
- **Translation options**: Global options apply to all messages (reading level, formality, etc.)
- **Error policy**: Fail-fast - aborts entire batch on first error

### Input File Format

```json
["Message 1...", "Message 2...", "Message 3..."]
```

**Validation:**

- Must be valid JSON array
- Array must contain at least 1 item
- All items must be strings
- Each message max 20,000 characters (auto-truncated)

````

- [ ] **Step 2: Commit README update**

```bash
git add README.md
git commit -m "docs: add batch translation usage guide to README"
````

---

## Definition of Done Checklist

- [ ] All tests pass: `bun test`
- [ ] No type errors: `bun run typecheck`
- [ ] No lint errors: `bun run lint`
- [ ] `inputs/messages.json` with 3+ items runs successfully
- [ ] Tab lifecycle verified: item[0] reuses tab, item[1]+ opens new tab
- [ ] Error handling verified: missing file, invalid JSON, empty array all exit(1) with clear messages
- [ ] Docker volume mount works: `./inputs:/app/inputs`
- [ ] Console output shows "Message X/N" progress for each item
- [ ] Browser closes automatically after batch complete
- [ ] README updated with usage instructions

---

## Files Summary

**Created:**

- `nghien_cuu_cua_toi/src/services/batch-translation.service.ts`
- `nghien_cuu_cua_toi/src/services/batch-translation.service.test.ts`
- `nghien_cuu_cua_toi/inputs/messages.json.example`

**Modified:**

- `nghien_cuu_cua_toi/src/config/translation.config.ts` (added INPUT_FILE constants)
- `nghien_cuu_cua_toi/src/config/translation.config.test.ts` (added constant tests)
- `nghien_cuu_cua_toi/src/services/interfaces/browser.interface.ts` (added openNewTab)
- `nghien_cuu_cua_toi/src/services/browser.service.ts` (implemented openNewTab)
- `nghien_cuu_cua_toi/src/services/browser.service.test.ts` (added openNewTab tests)
- `nghien_cuu_cua_toi/src/index.ts` (replaced main with batch translation)
- `nghien_cuu_cua_toi/src/index.test.ts` (added readInputFile tests)
- `nghien_cuu_cua_toi/.gitignore` (excluded inputs/)
- `nghien_cuu_cua_toi/docker-compose.yml` (added inputs volume)
- `README.md` (added batch translation section)

---

## Execution Complete

This plan is ready for execution. Two options:

**1. Subagent-Driven (recommended)** - Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
