# Refactor Specification: Production-Ready Kagi Translation Script

**Version:** 1.1  
**Date:** 2026-03-30  
**Prepared by:** AI-assisted (Interview-driven)  
**Status:** Approved - Ready for Implementation

---

## 🎯 Objective

Refactor `nghien_cuu_cua_toi/` từ research PoC script thành **production-ready codebase** với:

- TDD workflow
- ≥95% test coverage
- Clean Code principles
- SOLID architecture
- Docker optimization

---

## 📦 Scope

### In-Scope

- ✅ Split `index.ts` (393 lines) thành `src/` structure theo layers
- ✅ Implement TDD workflow với Bun:test
- ✅ Unit tests (co-located `*.test.ts`)
- ✅ Integration tests (co-located)
- ✅ E2E tests (separate `tests/e2e/`)
- ✅ **≥95% code coverage threshold** (best effort)
- ✅ Apply SRP + DIP + ISP (SOLID)
- ✅ Apply Clean Code (meaningful names, small functions, error handling)
- ✅ Refactor Dockerfile + docker-compose.yml (optimize, health check, best practices)
- ✅ Update README.md + code documentation

### Out-of-Scope

- ❌ CI/CD integration (local-only testing)
- ❌ CLI tool conversion
- ❌ API/frontend development
- ❌ Multi-provider support (chỉ Kagi)

---

## 🚫 Non-Goals

- Không thay đổi runtime (giữ Bun)
- Không thêm dependencies ngoài Bun:test
- Không phá vỡ ONE COMMAND workflow (`bun run start`)
- Không over-engineer (đây vẫn là PoC, nhưng production-grade)

---

## ✅ Definition of Done

1. ✅ All tests pass (unit + integration + e2e)
2. ✅ **≥95% code coverage** (measured by `bun test --coverage`)
3. ✅ ESLint + TypeScript compile without errors
4. ✅ Docker `bun run start` works (ONE COMMAND)
5. ✅ README.md updated với new structure
6. ✅ Clean Code + SOLID applied
7. ✅ Incremental git commits cho từng phase

---

## 🔒 Constraints

- **Runtime:** Bun (keep existing)
- **Core dependency:** `puppeteer-real-browser` (keep existing)
- **Test framework:** Bun:test (new)
- **Docker workflow:** `bun run start` must work
- **File structure:** `src/` layers (không flat, không domain-driven)

---

## 🏗️ Technical Implementation

### Target File Structure

```
nghien_cuu_cua_toi/
├── src/
│   ├── types/
│   │   ├── index.ts                      # Re-export all types
│   │   ├── translation.types.ts          # ReadingLevel, Formality, etc.
│   │   └── translation.types.test.ts
│   ├── config/
│   │   ├── index.ts
│   │   ├── translation.config.ts         # Config constants
│   │   └── translation.config.test.ts
│   ├── services/
│   │   ├── index.ts
│   │   ├── url-builder.service.ts        # buildKagiUrl + validation
│   │   ├── url-builder.service.test.ts
│   │   ├── browser.service.ts            # Puppeteer automation
│   │   ├── browser.service.test.ts
│   │   └── interfaces/                   # DIP abstractions
│   │       ├── url-builder.interface.ts
│   │       └── browser.interface.ts
│   ├── errors/
│   │   ├── index.ts
│   │   ├── validation.error.ts           # Custom errors
│   │   └── browser.error.ts
│   └── index.ts                           # Main entry point
├── tests/
│   └── e2e/
│       ├── translation.e2e.test.ts        # Smoke tests (1-2 real browser)
│       └── translation-mocked.e2e.test.ts # Mocked scenarios (~30-40)
├── Dockerfile                              # Refactored
├── docker-compose.yml                      # Refactored
├── .dockerignore                           # Enhanced
├── package.json                            # Updated scripts
├── README.md                               # Updated
├── tsconfig.json                           # Updated paths
└── REFACTOR-SPEC.md                        # This file
```

### SOLID Principles Implementation

#### 1. SRP (Single Responsibility Principle)

**Current violations:**

- `index.ts` does everything: types, config, URL building, browser automation, logging

**Solution:**

- `url-builder.service.ts`: Chỉ build URL
- `browser.service.ts`: Chỉ browser automation
- `validation.error.ts`: Chỉ error handling
- `translation.config.ts`: Chỉ configuration

#### 2. DIP (Dependency Inversion Principle)

**Current violations:**

- No abstractions, everything concrete
- Hard to test, hard to mock

**Solution:**

- Create interfaces: `IUrlBuilder`, `IBrowserService`
- Services implement interfaces
- Main `index.ts` depends on abstractions, not concrete classes

**Example:**

```typescript
// services/interfaces/url-builder.interface.ts
export interface IUrlBuilder {
  build(text: string, options: TranslationOptions): string
}

// services/url-builder.service.ts
export class KagiUrlBuilder implements IUrlBuilder {
  build(text: string, options: TranslationOptions): string {
    // implementation
  }
}

// src/index.ts
const urlBuilder: IUrlBuilder = new KagiUrlBuilder()
const url = urlBuilder.build(INPUT_TEXT, options)
```

#### 3. ISP (Interface Segregation Principle)

**Solution:**

- Nhỏ interfaces thay vì god interface
- `IUrlBuilder` chỉ có `build()`, không có browser methods
- `IBrowserService` chỉ có `navigate()`, `scrape()`, `close()`

### Clean Code Patterns

#### 1. Meaningful Names

**Before:**

```typescript
function build(t: string, o: any): string { ... }
```

**After:**

```typescript
function buildKagiUrl(text: string, options: TranslationOptions): string { ... }
```

**Rules:**

- Functions: Verb-noun (`buildKagiUrl`, `validateReadingLevel`)
- Classes: Noun (`KagiUrlBuilder`, `BrowserService`)
- Errors: Descriptive (`ValidationError`, `BrowserAutomationError`)
- Variables: Descriptive context (`translationUrl`, `browserInstance`)

#### 2. Small Functions

**Rules:**

- Max 20-30 lines per function
- Single responsibility per function
- Extract complex logic into helper functions

**Example:**

```typescript
// Before (60+ lines)
async function main() {
  // config
  // validation
  // URL building
  // browser launch
  // navigation
  // scraping
  // cleanup
}

// After (8 lines)
async function main() {
  const config = loadConfig()
  const url = urlBuilder.build(config.text, config.options)
  const browser = await browserService.launch()
  const result = await browserService.translate(url)
  console.log(result)
  await browserService.close()
}
```

#### 3. Error Handling

**Before:**

```typescript
throw new Error('Invalid readingLevel')
```

**After:**

```typescript
// errors/validation.error.ts
export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    public readonly allowedValues: readonly string[],
  ) {
    super(`Invalid ${field}: "${value}". Allowed: ${allowedValues.join(', ')}`)
    this.name = 'ValidationError'
  }
}

// Usage
throw new ValidationError('readingLevel', 'x99', READING_LEVELS)
```

---

## 🧪 Test Strategy

### Coverage Target

- **Threshold:** ≥95% (best effort, không bắt buộc 100%)
- **Allowed gaps:** Trivial getters, defensive null checks, unreachable error branches
- **Focus:** Critical paths (URL building, validation, browser automation)

### Test Types

#### Unit Tests (Co-located `*.test.ts`)

**Scope:** ~50-60 tests

- URL builder logic (30-40 pairwise combos)
  - Boundaries: defaults, extremes
  - Critical combos: Vietnamese formality + reading levels
  - Invalid values: validation errors
- Validation logic
- Type guards
- Error message formatting

**Example:**

```typescript
// src/services/url-builder.service.test.ts
import { describe, it, expect } from 'bun:test'

describe('KagiUrlBuilder', () => {
  describe('build()', () => {
    it('should build URL with defaults (no extra params)', () => {
      const url = urlBuilder.build('Hello', {
        sourceLang: 'auto',
        targetLang: 'vi',
        readingLevel: 'standard',
        // ... all defaults
      })
      expect(url).toBe('https://translate.kagi.com/?from=auto&to=vi&text=Hello')
    })

    it('should include language_complexity for non-standard reading level', () => {
      // ... pairwise test cases
    })

    it('should throw ValidationError for invalid reading level', () => {
      expect(() => {
        urlBuilder.build('Hello', { readingLevel: 'x99' as any })
      }).toThrow(ValidationError)
    })
  })
})
```

#### Integration Tests (Co-located `*.test.ts`)

**Scope:** ~10-15 tests

- Services interaction (URLBuilder + Config)
- Error propagation across layers
- Interface contract compliance

**Example:**

```typescript
// src/index.test.ts (integration)
import { describe, it, expect } from 'bun:test'

describe('Integration: Config + URLBuilder', () => {
  it('should build URL from config constants', () => {
    const config = loadConfig()
    const url = urlBuilder.build(config.text, config.options)
    expect(url).toContain('from=auto')
  })
})
```

#### E2E Tests (Separate `tests/e2e/`)

**Smoke Tests (1-2 real browser):** `tests/e2e/translation.e2e.test.ts`

- Default config → verify real Kagi translation
- Full advanced settings → verify all params work
- **⚠️ Rate limit protection:** Wait 3-5s between real Kagi calls

**Mocked Tests (~30-40):** `tests/e2e/translation-mocked.e2e.test.ts`

- Mock Puppeteer responses
- Pairwise combinations (30-40 scenarios)
- No rate limit concerns (mocked)

**Example:**

```typescript
// tests/e2e/translation.e2e.test.ts (smoke)
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'

describe('E2E: Real Kagi Translation (Smoke)', () => {
  beforeAll(async () => {
    // Launch real browser
  })

  afterAll(async () => {
    // Close browser
  })

  it('should translate with default config', async () => {
    const result = await translate('Hello', defaultOptions)
    expect(result).toContain('Xin chào')
    await Bun.sleep(3000) // Rate limit protection
  })

  it('should translate with full advanced settings', async () => {
    const result = await translate('Hello', advancedOptions)
    expect(result).toBeTruthy()
    await Bun.sleep(3000) // Rate limit protection
  })
})

// tests/e2e/translation-mocked.e2e.test.ts (mocked)
describe('E2E: Mocked Kagi Responses', () => {
  it('should handle pairwise combo: c2 + vietnamese_formal', async () => {
    mockPuppeteer.mockResponse('Formal translation result')
    const result = await translate('Hello', { readingLevel: 'c2', formality: 'vietnamese_formal' })
    expect(result).toBe('Formal translation result')
    // No rate limit delay needed (mocked)
  })
})
```

### Pairwise Testing Strategy

**Problem:** 7 settings × (2-7 values each) = 378 exhaustive combinations

**Solution:** Pairwise testing reduces to ~30-40 test cases with equivalent coverage

**Settings:**

1. `READING_LEVEL`: 7 values (standard, a1-c2)
2. `SPEAKER_GENDER`: 3 values (unknown, neutral, feminine)
3. `ADDRESSEE_GENDER`: 3 values (unknown, neutral, feminine)
4. `STYLE`: 2 values (natural, literal)
5. `FORMALITY`: 3 values (standard, vietnamese_formal, vietnamese_casual)

**Critical Combinations:**

- Defaults (all standard/unknown/natural)
- Extremes (c2 + vietnamese_formal + feminine)
- Vietnamese-specific (vietnamese_formal, vietnamese_casual with various reading levels)

**Test Categories:**

- Boundaries: 5 tests
- Critical combos: 10 tests
- Pairwise matrix: 25-30 tests
- Invalid values: 5 tests

**Total:** ~50-60 unit tests

---

## 🐳 Docker Refactoring

### Dockerfile Improvements

**Current issues:**

- No health check
- Layer caching not optimized
- Using `latest` tag (not reproducible)
- Running as root

**Refactored Dockerfile:**

```dockerfile
# Use specific Bun version for reproducibility
FROM oven/bun:1.1.38 AS base

# Install system dependencies (cached layer)
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    xvfb \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (better caching)
COPY package.json bun.lockb ./

# Install dependencies (cached if package.json unchanged)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Create non-root user
RUN groupadd -r bunuser && useradd -r -g bunuser bunuser
RUN chown -R bunuser:bunuser /app
USER bunuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

# Set display for Xvfb
ENV DISPLAY=:99

# Start Xvfb and run script
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x24 & bun run src/index.ts"]
```

### docker-compose.yml Improvements

**Current issues:**

- No restart policy
- No logging configuration
- No resource limits

**Refactored docker-compose.yml:**

```yaml
version: '3.8'

services:
  translator:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: kagi-translator
    restart: unless-stopped
    environment:
      - DISPLAY=:99
    logging:
      driver: json-file
      options:
        max-size: '10m'
        max-file: '3'
    # Optional: Resource limits
    # deploy:
    #   resources:
    #     limits:
    #       cpus: '2'
    #       memory: 2G
```

### .dockerignore Improvements

**Current:** Only 4 entries

**Enhanced:**

```
node_modules
.git
.gitignore
.DS_Store
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
tests/
*.test.ts
coverage/
.vscode/
.idea/
*.md
!README.md
.env
.env.*
dist/
build/
```

### package.json Scripts

**Keep ONE COMMAND workflow:**

```json
{
  "scripts": {
    "start": "docker-compose up --build",
    "test": "bun test",
    "test:coverage": "bun test --coverage",
    "test:unit": "bun test --exclude tests/e2e",
    "test:e2e": "bun test tests/e2e",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## 🚀 Implementation Phases

### Phase-by-Phase Rollout (Incremental Commits)

#### Phase 1: Project Setup

- Create `src/`, `tests/e2e/` folders
- Update `tsconfig.json` with paths
- Add Bun:test to `package.json`
- **Commit:** "chore: setup project structure for refactor"

#### Phase 2: Extract Types

- Create `src/types/translation.types.ts`
- Move type definitions from `index.ts`
- Add `src/types/index.ts` barrel export
- Add `src/types/translation.types.test.ts`
- **Commit:** "refactor: extract translation types"

#### Phase 3: Extract Config

- Create `src/config/translation.config.ts`
- Move config constants from `index.ts`
- Add `src/config/index.ts` barrel export
- Add `src/config/translation.config.test.ts`
- **Commit:** "refactor: extract translation config"

#### Phase 4: Extract URL Builder Service

- Create `src/services/interfaces/url-builder.interface.ts`
- Create `src/services/url-builder.service.ts`
- Move `buildKagiUrl()` + `validateEnum()` logic
- Add `src/services/url-builder.service.test.ts` (30-40 pairwise tests)
- **Commit:** "refactor: extract URL builder service with DIP"

#### Phase 5: Extract Browser Service

- Create `src/services/interfaces/browser.interface.ts`
- Create `src/services/browser.service.ts`
- Move Puppeteer logic from `index.ts`
- Add `src/services/browser.service.test.ts` (mocked Puppeteer)
- **Commit:** "refactor: extract browser service with DIP"

#### Phase 6: Extract Custom Errors

- Create `src/errors/validation.error.ts`
- Create `src/errors/browser.error.ts`
- Create `src/errors/index.ts` barrel export
- Update services to use custom errors
- **Commit:** "refactor: add custom error classes"

#### Phase 7: Refactor Main Entry Point

- Update `src/index.ts` to use services
- Apply DIP (depend on interfaces)
- Keep small, clean main function
- **Commit:** "refactor: clean up main entry point with DIP"

#### Phase 8: Add Integration Tests

- Add `src/index.test.ts` (integration tests)
- Test service interactions
- Test error propagation
- **Commit:** "test: add integration tests"

#### Phase 9: Add E2E Tests

- Create `tests/e2e/translation.e2e.test.ts` (smoke tests with rate limiting)
- Create `tests/e2e/translation-mocked.e2e.test.ts` (mocked scenarios)
- **Commit:** "test: add e2e tests with rate limit protection"

#### Phase 10: Refactor Docker

- Update `Dockerfile` (health check, caching, non-root)
- Update `docker-compose.yml` (restart, logging)
- Update `.dockerignore`
- Test `bun run start` still works
- **Commit:** "chore: optimize Docker setup"

#### Phase 11: Update Documentation

- Update `README.md` with new structure
- Add migration guide
- Update JSDoc in all files
- **Commit:** "docs: update README for refactored structure"

#### Phase 12: Verify Definition of Done

- Run `bun test --coverage` (verify ≥95%)
- Run `bun run lint` (verify no errors)
- Run `bun run typecheck` (verify no errors)
- Run `bun run start` (verify Docker works)
- **Commit:** "chore: verify all DoD criteria"

---

## ⚠️ Risks & Mitigations

### Risk 1: ≥95% Coverage Ambitious

**Mitigation:**

- Use pairwise testing (not exhaustive)
- Skip trivial code (getters, defensive checks)
- Focus on critical paths

### Risk 2: E2E Tests Brittle with Real Kagi API

**Mitigation:**

- Smoke tests (1-2 only) with **3-5s delay between calls**
- Majority mocked (~30-40 tests)
- Docker e2e also throttled if real browser

### Risk 3: Large Refactor

**Mitigation:**

- Incremental commits (12 phases)
- Easy rollback per phase
- Tests at each phase

### Risk 4: Docker ONE COMMAND Workflow Might Break

**Mitigation:**

- Test `bun run start` after Docker refactor
- Keep docker-compose simple
- Rollback if broken

---

## 🔐 Security & Compliance

### Rate Limit Protection

- **E2E smoke tests:** 3-5s delay between real Kagi calls
- **Docker e2e:** Same throttling strategy
- **Mocked e2e:** No throttling needed (mocked responses)

### Data Privacy

- No data persistence (input/output không lưu)
- No secrets (Kagi public API)

### Docker Security

- Use specific Bun version (not `latest`)
- Non-root user in container
- Trusted base image (`oven/bun`)

---

## 📚 Documentation Updates

### README.md Structure

```markdown
# Kagi Translation Script (Production-Ready)

## Overview

Production-grade TypeScript script for Kagi Translate automation with 95%+ test coverage.

## Quick Start

\`\`\`bash
bun run start # Build + Run in Docker (ONE COMMAND)
\`\`\`

## Development

\`\`\`bash
bun install
bun test # Run all tests
bun test --coverage # With coverage report
bun test:unit # Unit + integration only
bun test:e2e # E2E tests only
bun run lint # ESLint
bun run typecheck # TypeScript check
\`\`\`

## Project Structure

[New file structure diagram]

## Configuration

[Advanced settings documentation]

## Testing

- Unit: 50-60 tests (co-located)
- Integration: 10-15 tests
- E2E: 2 smoke + 30-40 mocked
- Coverage: ≥95%

## Architecture

- SOLID principles (SRP, DIP, ISP)
- Clean Code patterns
- Dependency Inversion with interfaces

## Migration Guide

[From old index.ts to new structure]
```

---

## 🎯 Success Criteria Summary

**Must Have:**

- ✅ ≥95% test coverage
- ✅ All tests pass (unit + integration + e2e)
- ✅ ESLint + TypeScript pass
- ✅ Docker `bun run start` works
- ✅ SRP + DIP + ISP applied
- ✅ Clean Code patterns applied
- ✅ README updated
- ✅ Incremental commits

**Nice to Have:**

- 100% coverage (if achievable without wasteful tests)
- CI/CD integration (future)
- Multi-provider support (future)

---

## 📝 Notes

### Design Decisions

1. **Why Bun:test instead of Vitest?**
   - User chose Bun:test for simplicity
   - Native Bun support, no extra config
   - Sufficient features for this project

2. **Why ≥95% instead of 100%?**
   - User preference: "best effort"
   - Avoids wasteful tests (trivial code)
   - Focus on critical paths

3. **Why co-located tests instead of separate tests/ folder?**
   - Project convention (`CLAUDE.md` → `ai_rules/test-colocation.md`)
   - Better DX (tests near code)
   - Monorepo pattern (`packages/` use co-location)

4. **Why separate e2e tests?**
   - E2E tests run slow, need Docker
   - Not tied to specific files
   - User acceptance: "Co-located + e2e/ separate"

5. **Why rate limit e2e tests?**
   - Kagi may have undocumented rate limits
   - Production consideration (responsible API usage)
   - Prevents test failures from throttling

6. **Why SRP + DIP + ISP, not full SOLID?**
   - Blast radius small (PoC script)
   - OCP/LSP less relevant (single implementation)
   - User choice: "SRP + DIP + ISP recommended"

---

**End of Spec**
