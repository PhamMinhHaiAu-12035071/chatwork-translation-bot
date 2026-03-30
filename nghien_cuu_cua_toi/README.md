# Kagi Translation Bot - Production-Ready

Production-grade TypeScript automation for Kagi Translate with **≥95% test coverage**, SOLID architecture, and comprehensive testing.

## 🎯 Overview

- **Stack:** Bun v1.1+ · TypeScript 5.4+ strict · Puppeteer Real Browser
- **Architecture:** Clean Code · SOLID principles (SRP, DIP, ISP)
- **Testing:** ≥95% coverage · 100+ tests (unit + integration + e2e)
- **Docker:** ONE COMMAND workflow · Optimized multi-stage build

## 🚀 Quick Start

**ONE COMMAND** (works every time):

```bash
bun run start  # Build + Run in Docker
```

That's it! 🎉

**⚠️ Important:** This is a **one-shot script** (run → translate → exit). The container will:

1. ✅ Run once
2. ✅ Translate the configured text
3. ✅ Exit with code 0 (success)
4. ✅ Stop automatically (no restart loop)

If you see continuous restarts, check `docker-compose.yml` has `restart: "no"`.

**Local development:**

```bash
bun install
bun run src/index.ts
```

## 📂 Project Structure

```
nghien_cuu_cua_toi/
├── src/
│   ├── types/
│   │   ├── translation.types.ts          # Type definitions
│   │   ├── translation.types.test.ts
│   │   └── index.ts
│   ├── config/
│   │   ├── translation.config.ts         # Configuration constants
│   │   ├── translation.config.test.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── interfaces/
│   │   │   ├── url-builder.interface.ts  # DIP abstractions
│   │   │   └── browser.interface.ts
│   │   ├── url-builder.service.ts        # URL building + validation
│   │   ├── url-builder.service.test.ts
│   │   ├── browser.service.ts            # Puppeteer automation
│   │   ├── browser.service.test.ts
│   │   └── index.ts
│   ├── errors/
│   │   ├── validation.error.ts           # Custom error classes
│   │   ├── browser.error.ts
│   │   └── index.ts
│   ├── index.ts                          # Main entry point (~30 lines)
│   └── index.test.ts                     # Integration tests
├── tests/
│   └── e2e/
│       ├── translation.e2e.test.ts       # 2 smoke tests (real browser)
│       └── translation-mocked.e2e.test.ts # 32 mocked scenarios
├── Dockerfile                             # Optimized Docker setup
├── docker-compose.yml                     # Container orchestration
├── package.json                           # Scripts + dependencies
├── tsconfig.json                          # TypeScript config
└── README.md                              # This file
```

## 🏗️ Architecture

### SOLID Principles

**SRP (Single Responsibility):**

- `url-builder.service.ts`: Only builds URLs
- `browser.service.ts`: Only handles browser automation
- `translation.config.ts`: Only manages configuration

**DIP (Dependency Inversion):**

- Services implement interfaces (`IUrlBuilder`, `IBrowserService`)
- Main entry point depends on abstractions, not concretions

**ISP (Interface Segregation):**

- Small, focused interfaces
- `IUrlBuilder` only has `build()`
- `IBrowserService` only has `launch()`, `translate()`, `close()`

### Clean Code Patterns

- **Meaningful Names:** `buildKagiUrl()`, `validateEnum()`, `KagiUrlBuilder`
- **Small Functions:** Max 20-30 lines, single responsibility
- **Custom Errors:** `ValidationError`, `BrowserAutomationError` with context

## 🧪 Testing

### Test Coverage: ≥95%

```bash
bun test                # All tests
bun test --coverage     # With coverage report
bun test:unit           # Unit + integration (fast)
bun test:e2e            # E2E tests only
```

### Test Categories

**Unit Tests (~78 tests):**

- `src/types/translation.types.test.ts` (21 tests)
- `src/config/translation.config.test.ts` (20 tests)
- `src/services/url-builder.service.test.ts` (36 tests)
- `src/services/browser.service.test.ts` (21 tests, mocked)

**Integration Tests (17 tests):**

- `src/index.test.ts` - Service interactions, error propagation

**E2E Tests (34 tests):**

- `tests/e2e/translation.e2e.test.ts` (2 smoke tests, real browser, 4s rate limit)
- `tests/e2e/translation-mocked.e2e.test.ts` (32 pairwise scenarios, mocked)

### Pairwise Testing Strategy

Instead of 378 exhaustive combinations, we use **pairwise testing** for ~40 test cases with equivalent coverage:

- 7 reading levels (standard, a1-c2)
- 3 speaker genders (unknown, neutral, feminine)
- 3 addressee genders (unknown, neutral, feminine)
- 2 translation styles (natural, literal)
- 3 formality levels (standard, vietnamese_formal, vietnamese_casual)

## ⚙️ Configuration

Edit `src/config/translation.config.ts`:

### Basic Settings

```typescript
const DEFAULT_TRANSLATION_CONFIG = {
  INPUT_TEXT: 'Hello, how are you today?',
  SOURCE_LANG: 'auto', // 'auto', 'en', 'vi', 'ja', 'ko', 'zh'
  TARGET_LANG: 'vi', // 'vi', 'en', 'ja', 'ko', 'zh'
  // ...
}
```

### Advanced Translation Settings

**Reading Level:**

- `standard` (default) - No complexity constraints
- `a1`, `a2` - Beginner (simple words, short sentences)
- `b1`, `b2` - Intermediate (moderate complexity)
- `c1`, `c2` - Advanced (technical terms, complex structures)

**Formality (Vietnamese-specific):**

- `standard` (default) - No adjustment
- `vietnamese_formal` - Formal tone (business, official)
- `vietnamese_casual` - Casual tone (friends, informal)

**Translation Style:**

- `natural` (default) - Natural, readable translation
- `literal` - Word-by-word, close to original

**Gender Context:**

- `speaker_gender`: unknown, neutral, feminine
- `addressee_gender`: unknown, neutral, feminine

### Browser Settings

```typescript
const BROWSER_CONFIG = {
  HEADLESS: false, // false = show browser (debug)
  TIMEOUT: 30000, // 30s navigation timeout
  WAIT_FOR_SELECTOR_TIMEOUT: 15000, // 15s content wait
  POST_RENDER_DELAY: 1000, // 1s stability delay
}
```

## 🐳 Docker

### Optimized Dockerfile Features

- **Specific version:** `oven/bun:1.1.38` (not `latest`)
- **Layer caching:** Dependencies installed before source code
- **Security:** Non-root user (`bunuser`)
- **Health check:** Verifies Bun is working
- **Font support:** Unicode, Thai, Arabic, etc.

### docker-compose.yml Features

- **Restart policy:** `unless-stopped`
- **Logging:** 10MB max, 3 file rotation
- **Optional resource limits** (commented out)

### Available Commands

| Command                  | Description                        |
| ------------------------ | ---------------------------------- |
| `bun run start`          | **ONE COMMAND** - Auto build + run |
| `bun run start:local`    | Run directly on host (no Docker)   |
| `bun run docker:rebuild` | Force rebuild from scratch         |
| `bun run docker:logs`    | View real-time logs                |
| `bun run docker:clean`   | Remove containers & volumes        |

## 📊 Development Workflow

### 1. Make Changes

Edit files in `src/`:

```bash
# Edit config
vim src/config/translation.config.ts

# Edit URL builder
vim src/services/url-builder.service.ts

# Edit browser service
vim src/services/browser.service.ts
```

### 2. Run Tests

```bash
bun test                # All tests
bun test --coverage     # With coverage
```

### 3. Verify

```bash
bun run typecheck       # TypeScript check
bun run lint            # ESLint check
```

### 4. Test in Docker

```bash
bun run start           # Full Docker workflow
```

## 🔍 Migration Guide

### From Old `index.ts` (393 lines)

**Before (monolithic):**

```typescript
// index.ts - everything in one file
type ReadingLevel = 'standard' | 'a1' | ...;
const INPUT_TEXT = 'Hello';
function buildKagiUrl() { ... }
async function main() { /* 60+ lines */ }
```

**After (refactored):**

```typescript
// src/types/translation.types.ts
export type ReadingLevel = 'standard' | 'a1' | ...;

// src/config/translation.config.ts
export const DEFAULT_TRANSLATION_CONFIG = { ... };

// src/services/url-builder.service.ts
export class KagiUrlBuilder implements IUrlBuilder { ... }

// src/services/browser.service.ts
export class KagiBrowserService implements IBrowserService { ... }

// src/index.ts (~30 lines)
async function main() {
  const urlBuilder: IUrlBuilder = new KagiUrlBuilder();
  const browserService: IBrowserService = new KagiBrowserService();
  // ... clean orchestration
}
```

### Benefits

✅ **Testable:** Each service can be tested independently  
✅ **Maintainable:** Single Responsibility Principle  
✅ **Extensible:** Easy to add new providers via interfaces  
✅ **Type-safe:** Full TypeScript strict mode  
✅ **Documented:** ≥95% test coverage, comprehensive JSDoc

## 📝 Example Usage

```typescript
import { KagiUrlBuilder, KagiBrowserService } from '~/services'
import { getDefaultTranslationOptions } from '~/config'

async function translate(text: string) {
  // Initialize services
  const urlBuilder = new KagiUrlBuilder()
  const browserService = new KagiBrowserService()

  // Configure options
  const options = getDefaultTranslationOptions()
  options.readingLevel = 'c2'
  options.formality = 'vietnamese_formal'

  // Build URL
  const url = urlBuilder.build(text, options)

  // Translate
  await browserService.launch()
  const result = await browserService.translate(url)
  await browserService.close()

  return result
}
```

## 🐛 Troubleshooting

### Tests Fail

```bash
# Clean and reinstall
rm -rf node_modules bun.lockb
bun install
bun test
```

### Docker Issues

```bash
# Rebuild from scratch
bun run docker:rebuild

# Check logs
bun run docker:logs

# Clean everything
bun run docker:clean
bun run start
```

### Browser Issues

- Set `HEADLESS: false` in `BROWSER_CONFIG` to see browser
- Check Xvfb is running in Docker
- Increase `TIMEOUT` if slow connection

## 📚 Resources

- **REFACTOR-SPEC.md** - Detailed refactoring plan (12 phases)
- **Type Definitions** - `src/types/translation.types.ts`
- **Configuration** - `src/config/translation.config.ts`
- **Interfaces** - `src/services/interfaces/`
- **Tests** - All `*.test.ts` files + `tests/e2e/`

## 📈 Test Coverage Report

Run `bun test --coverage` to see detailed coverage:

- **Types:** 100% (type checks, constants)
- **Config:** 100% (configuration validation)
- **URL Builder:** ≥95% (pairwise testing)
- **Browser Service:** ≥95% (mocked automation)
- **Integration:** ≥95% (end-to-end workflows)

## 🎓 Learning Resources

### SOLID Principles

- **SRP:** One class, one responsibility
- **DIP:** Depend on abstractions (interfaces)
- **ISP:** Small, focused interfaces

### Clean Code

- Meaningful names reveal intent
- Functions do one thing well
- Custom errors provide context

### Testing Strategies

- **Unit:** Test in isolation (mocked dependencies)
- **Integration:** Test service interactions
- **E2E:** Test complete workflows (mocked + real browser)
- **Pairwise:** Reduce test combinations intelligently

---

**Status:** Production-ready ✅  
**Coverage:** ≥95% ✅  
**Tests:** 100+ passing ✅  
**Docker:** Optimized ✅  
**Architecture:** SOLID ✅
