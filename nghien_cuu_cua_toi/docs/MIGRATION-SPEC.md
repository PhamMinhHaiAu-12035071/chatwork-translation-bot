# Migration Specification: puppeteer-real-browser → patchright

**Version:** 1.0  
**Date:** 2026-04-15  
**Prepared by:** AI-assisted (Claude)  
**Status:** APPROVED

---

## Executive Summary

Complete migration from `puppeteer-real-browser` to `patchright` (patched Playwright Chromium) with comprehensive improvements:

- **NEW CRITICAL FEATURE**: Login verification with fail-fast for Cloudflare bypass
- Humanizer behavior enhancements (3 key improvements)
- Full test coverage (unit + integration + E2E)
- Code quality and performance optimizations
- Clean removal of all legacy references

---

## 1. Objective

Transform the Kagi translation automation codebase from puppeteer-real-browser to patchright while:

1. ✅ Verifying migration completeness and correctness
2. ✅ Adding critical login verification business logic
3. ✅ Improving humanizer behavior to near-real-human levels
4. ✅ Achieving full test coverage
5. ✅ Optimizing code quality and performance
6. ✅ Updating documentation

---

## 2. Scope

### In-Scope

#### 2.1 Login Verification (NEW - CRITICAL)

**Requirement:** Implement fail-fast login verification after cookie injection.

**Flow:**

```
1. Inject session cookies via visitKagiOriginAndInjectSessionCookies()
2. Navigate to https://kagi.com/settings
3. Check if URL remains at /settings:
   - YES → Login success, continue to translate
   - NO (redirected to /signin or elsewhere) → Throw BrowserAutomationError, fail-fast
```

**Success Criteria:**

- URL after navigation: `https://kagi.com/settings` (exact match, no redirect)

**Failure Criteria:**

- URL after navigation: `https://kagi.com/signin` or any other URL
- Timeout reaching /settings page
- Page load errors

**Error Handling:**

- On failure: `throw new BrowserAutomationError('login-verification-failed', finalUrl, errorDetails)`
- No retry attempts (fail-fast principle)
- Clear error message indicating cookie file may be invalid/expired

**Timing:**

- Execute AFTER: `visitKagiOriginAndInjectSessionCookies()`
- Execute BEFORE: Navigate to translate URL in `translate()` method

**Implementation Location:**

- New method: `verifyLoginSuccess()` in `KagiBrowserService`
- Called from: `translate()` method, before Step 2 (navigate to translate URL)

#### 2.2 Cleanup Legacy Code

**Files containing puppeteer-real-browser references (detected):**

1. `src/services/browser.service.ts`
2. `src/services/human-interaction.service.ts`
3. `src/services/human-interaction.service.test.ts`
4. `src/services/interfaces/human-interaction.interface.ts`

**Actions:**

- Remove all comments mentioning `puppeteer-real-browser`, `rebrowser`, `ghost-cursor`
- Remove unused imports/types if any remain
- Clean up commented-out code related to old approach
- Verify no runtime dependencies on old packages

#### 2.3 Humanizer Improvements (3 Key Enhancements)

**Current State:**

- Basic random jitter in click/type operations (+/- 3px for clicks, 50-150ms for typing)
- Simple delays between actions
- No sophisticated human patterns

**Target State:**

- **A. Increased Randomness:**
  - Variable delay patterns (not just uniform random)
  - Jitter in mouse movements (not just destination)
  - Randomize action sequences where order doesn't matter
  - Add occasional "hesitation" delays

- **B. Better Typing Behavior:**
  - Burst typing (fast sequences followed by pauses)
  - Simulated typing mistakes (occasional backspace + correction)
  - Longer pauses after punctuation and sentence endings
  - Variable WPM (words per minute) instead of constant character delay

- **C. Mouse Curves (Bezier Movement):**
  - Replace linear `mouse.move()` with curved paths
  - Implement bezier curves for natural mouse trajectories
  - Add slight overshoot + correction for some clicks
  - Randomize curve control points

**Expected Outcome:** Behavior indistinguishable from real human interaction for anti-bot systems.

#### 2.4 Code Quality Improvements

- Refactor duplicated code into shared utilities
- Strengthen TypeScript types (remove any remaining `any` types)
- Add JSDoc comments for public APIs
- Improve error messages with actionable context
- Consistent naming conventions across services
- Extract magic numbers into named constants

#### 2.5 Performance Optimizations

- Optimize wait/delay durations (remove excessive waits)
- Use `waitForFunction` over `sleep` where appropriate
- Reduce redundant DOM queries
- Profile and optimize hot paths (translation flow)
- Minimize screenshot captures (only for debugging when needed)

#### 2.6 Test Coverage (FULL)

**Unit Tests:**

- All service methods (KagiBrowserService, HumanInteractionService)
- All utility functions (kagi-session-cookies.ts)
- Config/constants validation
- Error handling paths

**Integration Tests:**

- Browser launch + close lifecycle
- Cookie injection + verification flow
- Login verification (success + failure scenarios)
- Full settings interaction sequence

**E2E Tests:**

- Happy path: inject cookies → verify login → translate → get result
- Edge cases:
  - Invalid cookie file
  - Expired session
  - Cloudflare challenge during translate
  - Missing elements/selectors
  - Network timeouts
  - Large text input (10,000+ chars)

**Test Tooling:**

- Bun test (existing framework)
- Mocking strategy for browser operations
- Test fixtures for cookie files

#### 2.7 Documentation

**README Updates:**

- New section: "Session Cookie Setup"
  - How to export cookies from browser
  - Where to place cookie JSON file
  - Environment variables (KAGI_SESSION_FILE)
- Updated "Getting Started" with login verification flow
- Troubleshooting section for login failures
- Architecture diagram showing patchright integration

**Code Documentation:**

- JSDoc for `verifyLoginSuccess()` method
- Update existing JSDoc mentioning old approach
- Inline comments for complex humanizer logic

### Out-of-Scope

- ❌ Backward compatibility with puppeteer-real-browser
- ❌ Migration guide for external users (internal project)
- ❌ CI/CD pipeline modifications
- ❌ Browser binary management changes (keep current logic)
- ❌ Support for additional browsers (only Chromium via patchright)
- ❌ Automatic cookie refresh/renewal mechanism
- ❌ Manual login flow (user must provide valid cookies)

---

## 3. Non-Goals

- Supporting multiple translation services (only Kagi)
- Headless detection evasion beyond patchright's built-in capabilities
- Distributed/parallel translation execution
- Translation caching or persistence layer

---

## 4. Definition of Done

✅ **Functional:**

- Login verification works: success case proceeds, failure case throws error
- All humanizer improvements implemented and tested
- Translation flow completes successfully with new logic

✅ **Quality:**

- Zero puppeteer-real-browser references in codebase
- All linter rules pass (`bun run lint`)
- All type checks pass (`bun run typecheck`)
- Code coverage ≥ 80% for new/modified code

✅ **Testing:**

- All unit tests pass (`bun run test:unit`)
- All integration tests pass
- All E2E tests pass (`bun run test:e2e`)
- Manual smoke test on local dev + Docker environments

✅ **Documentation:**

- README updated with new sections
- Code comments added for complex logic
- No outdated references in docs

---

## 5. Constraints

### Technical Constraints

- **Language:** TypeScript 5.4+ strict mode
- **Runtime:** Bun 1.1+
- **Browser:** Chromium only (via patchright)
- **Headless Mode:** Must support both headless and headed modes
- **Secrets:** Cookie file managed via filesystem (no secret manager integration)

### Environment Constraints

- **Local Dev:** macOS/Linux with Chrome/Chromium installed
- **Docker:** Debian-based with Chrome binaries
- **Resource Limits:** Must run in 2GB RAM container

### Operational Constraints

- **No Manual Intervention:** Login verification must be fully automated
- **Fail-Fast:** No silent fallback to unauthenticated mode
- **Session Validity:** User responsible for providing valid cookies

---

## 6. Architecture

### Current State (Already Migrated)

```
┌─────────────────────────────────────────┐
│         KagiBrowserService              │
│  - launch() via patchright              │
│  - translate() with settings automation │
│  - scrapeTranslatedText()               │
└──────────────┬──────────────────────────┘
               │
               ├──> HumanInteractionService
               │    - click(), clickByTextContent()
               │    - typeIntoTextarea(), typeIntoContentEditable()
               │    - dragSlider(), chunkPaste()
               │
               └──> kagi-session-cookies.ts
                    - visitKagiOriginAndInjectSessionCookies()
```

### Target State (With Login Verification)

```
┌─────────────────────────────────────────┐
│         KagiBrowserService              │
│  - launch() via patchright              │
│  - translate():                         │
│    1. Inject cookies                    │
│    2. verifyLoginSuccess() ← NEW        │
│    3. Navigate to translate URL         │
│    4. Fill inputs + settings            │
│    5. Scrape result                     │
└──────────────┬──────────────────────────┘
               │
               ├──> HumanInteractionService (ENHANCED)
               │    - click() with bezier curves
               │    - type() with burst/mistakes/pauses
               │    - random jitter + hesitation
               │
               └──> kagi-session-cookies.ts (UNCHANGED)
```

### New Component: verifyLoginSuccess()

```typescript
async verifyLoginSuccess(page: Page, timeoutMs: number): Promise<void> {
  const SETTINGS_URL = 'https://kagi.com/settings';

  await page.goto(SETTINGS_URL, { waitUntil: 'networkidle', timeout: timeoutMs });

  const finalUrl = page.url();

  if (!finalUrl.startsWith(SETTINGS_URL)) {
    throw new BrowserAutomationError(
      'login-verification-failed',
      finalUrl,
      new Error(
        `Login verification failed: redirected to ${finalUrl}. ` +
        'Session cookies may be invalid or expired. ' +
        'Please update KAGI_SESSION_FILE with fresh cookies.'
      )
    );
  }

  console.log('✅ Login verification passed');
}
```

---

## 7. Data Model

### KagiSessionJsonFile

```typescript
interface KagiSessionJsonFile {
  url?: string // Optional first-hop URL (defaults to https://kagi.com)
  cookies: ChromeExportCookie[]
}

interface ChromeExportCookie {
  domain: string
  expirationDate?: number
  hostOnly?: boolean
  httpOnly?: boolean
  name: string
  path?: string
  sameSite?: string
  secure?: boolean
  session?: boolean
  storeId?: string
  value: string
}
```

**Validation Rules:**

- `cookies` array must not be empty
- Each cookie must have `name`, `value`, `domain`
- If `session: true`, `expirationDate` is optional
- File must be valid JSON

**Error States:**

- File not found (explicit KAGI_SESSION_FILE)
- Invalid JSON format
- Missing required fields
- Expired cookies (detected only at runtime via redirect)

---

## 8. Business Rules

### Login Verification Rules

1. **Mandatory Check:** Login verification MUST run before every translate operation
2. **No Bypass:** No configuration option to skip verification
3. **Cookie Expiry:** Detected only by redirect behavior (no client-side expiry check)
4. **Failure Response:** Immediate error throw, no retry, no fallback
5. **Success Definition:** URL matches `https://kagi.com/settings` after navigation

### Humanizer Behavior Rules

1. **Typing Speed:** Vary between 40-120 WPM (vs current fixed 50-150ms/char)
2. **Mistake Rate:** 1-3% of characters, immediately corrected
3. **Pause Pattern:** 200-500ms after periods, 100-300ms after commas
4. **Click Accuracy:** 95% within center 50% of target, 5% in outer 50%
5. **Mouse Speed:** Vary between 200-800 pixels/second

### Error Handling Rules

1. **Fail-Fast:** Throw on first critical error (login fail, missing element)
2. **Non-Fatal:** Log warning for UI quirks (dropdown already open, etc.)
3. **Context:** Include current URL, selector, and action in error messages
4. **Recovery:** No automatic retry for browser-level failures

---

## 9. UI/UX (N/A)

This is a backend automation service with no user-facing UI.

---

## 10. Edge Cases

### Login Verification Edge Cases

| Case                 | Scenario                             | Expected Behavior                                          |
| -------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Valid session        | Cookies fresh, no redirect           | Pass, proceed to translate                                 |
| Expired session      | Cookies expired, redirect to /signin | Throw error, halt                                          |
| Network timeout      | /settings page doesn't load          | Throw timeout error                                        |
| Cloudflare challenge | Redirect to challenge page           | Throw error (detected as non-/settings URL)                |
| Partial redirect     | Redirects to /settings?error=xyz     | **PASS** (URL starts with /settings)                       |
| No cookie file       | KAGI_SESSION_FILE not found          | Throw error in cookie injection step (before verification) |
| Empty cookie file    | JSON has empty cookies array         | Throw error in cookie loading step                         |

### Humanizer Edge Cases

| Case               | Scenario                                | Expected Behavior                           |
| ------------------ | --------------------------------------- | ------------------------------------------- |
| Very short text    | < 10 characters                         | Use humanized typing (no paste)             |
| Very long text     | > 2000 characters                       | Use chunkPaste with randomized chunk sizes  |
| Special characters | Emoji, unicode                          | Handle correctly without errors             |
| Element off-screen | Slider/button below fold                | scrollIntoViewIfNeeded() before interaction |
| Multiple matches   | Same selector returns multiple elements | Use `.first()` or explicit index            |

### Browser Edge Cases

| Case               | Scenario                               | Expected Behavior                              |
| ------------------ | -------------------------------------- | ---------------------------------------------- |
| Headless mode      | HEADLESS=true                          | All interactions work (no visual verification) |
| Docker environment | Limited display, Xvfb                  | Use evaluate() fallbacks for clicks/drags      |
| Browser crash      | Chromium process dies mid-translation  | Throw error, don't retry (fail-fast)           |
| Stale element      | Element removed from DOM after waitFor | Retry selector lookup, throw if still missing  |

---

## 11. Error Handling

### Error Categories

**1. Configuration Errors** (throw at startup)

- Missing KAGI_SESSION_FILE (if explicitly set)
- Invalid JSON in cookie file
- Missing required cookie fields

**2. Authentication Errors** (throw at verification)

- Login verification failed (redirect detected)
- Session cookie expired
- Cloudflare block (detected as redirect)

**3. Automation Errors** (throw during translate)

- Selector not found (element missing)
- Click/type failure (element not interactable)
- Timeout waiting for translation output
- Unexpected page state

**4. Network Errors** (throw on first occurrence)

- Page load timeout
- Network disconnected
- DNS resolution failure

### Error Messages

All errors include:

- **Error Code:** e.g., `login-verification-failed`, `selector-not-found`
- **Context:** URL, selector, action being performed
- **Actionable Guidance:** What user should do to fix

Example:

```
BrowserAutomationError: login-verification-failed
URL: https://kagi.com/signin
Context: Login verification after cookie injection
Message: Session cookies invalid or expired. Update KAGI_SESSION_FILE with fresh cookies exported from browser.
```

---

## 12. State Transitions

### Browser Lifecycle States

```
START
  ↓
LAUNCH (launchPersistentContext)
  ↓
COOKIES_INJECTED (visitKagiOriginAndInjectSessionCookies)
  ↓
LOGIN_VERIFIED (verifyLoginSuccess) ← NEW STATE
  ↓
TRANSLATING (translate method)
  ↓
RESULT_SCRAPED (scrapeTranslatedText)
  ↓
CLOSED (connection.close)
```

**Critical State:** LOGIN_VERIFIED

- Entry condition: URL = https://kagi.com/settings
- Exit condition: No redirect occurred
- Failure transition: → ERROR_STATE (throw)

---

## 13. Testing Strategy

### Unit Test Coverage

**KagiBrowserService:**

- `resolveChromiumExecutablePath()` - multiple platform paths
- `resolveKagiSessionFilePath()` - env var priority, fallbacks
- `verifyLoginSuccess()` - success case, redirect case, timeout case
- `scrapeTranslatedText()` - multiple selector strategies

**HumanInteractionService:**

- `click()` - valid rect, invalid rect, fallback
- `typeIntoTextarea()` - short text, long text, special chars
- `dragSlider()` - valid slider, off-screen slider, fallback
- `chunkPaste()` - chunk size randomization, tail handling

**kagi-session-cookies:**

- `chromeExportCookiesToPlaywright()` - cookie mapping, expiry handling
- `loadKagiSessionJsonFile()` - valid JSON, invalid JSON, missing file
- `visitKagiOriginAndInjectSessionCookies()` - successful injection

### Integration Test Coverage

**Full Flow (Mocked Browser):**

1. Launch → inject cookies → verify login → navigate translate → close
2. Launch → inject cookies → verify login FAILS → throw error
3. Launch → cookie file missing → throw error

**Settings Interaction:**

- Open settings dialog
- Drag slider to target value
- Click formality option
- Fill translation context
- Verify URL params update

### E2E Test Coverage (Real Browser)

**Happy Path:**

- Valid cookies → login success → translate "Hello" → get Vietnamese output

**Failure Paths:**

- Invalid cookies → login fail → error thrown before translate
- Expired cookies → redirect to /signin → error thrown
- Missing cookie file (explicit path) → error at injection step

**Edge Cases:**

- Very long text (5000+ chars) → chunkPaste → successful translation
- Headless mode → all interactions work
- Docker environment → fallback mechanisms work

### Test Data Fixtures

**Valid Cookie File:**

```json
{
  "url": "https://kagi.com",
  "cookies": [
    {
      "domain": ".kagi.com",
      "name": "session_id",
      "value": "abc123",
      "path": "/",
      "secure": true,
      "httpOnly": true,
      "expirationDate": 1735689600
    }
  ]
}
```

**Expired Cookie File:**

```json
{
  "cookies": [
    {
      "domain": ".kagi.com",
      "name": "session_id",
      "value": "expired123",
      "expirationDate": 1609459200
    }
  ]
}
```

---

## 14. Deployment

### Local Development

- Install Chrome/Chromium
- Set `KAGI_SESSION_FILE=/path/to/cookies.json`
- Run `bun run start:local`
- Browser opens in headed mode by default

### Docker

- Use `oven/bun:1.1-distroless` base image
- Mount cookie file: `-v ./secrets:/app/secrets`
- Set `KAGI_SESSION_FILE=/app/secrets/kagi-session.json`
- Run `docker-compose up`
- Browser runs in headless mode

### Environment Variables

```bash
# Required (if using cookies)
KAGI_SESSION_FILE=/absolute/path/to/cookies.json

# Optional
PORT=3000
NODE_ENV=production
USER_DATA_DIR=/path/to/user-data
SCREENSHOT_DIR=/path/to/screenshots
HEADLESS=true
```

---

## 15. Rollout Strategy

### Phase 1: Core Implementation (Critical Path)

1. Implement `verifyLoginSuccess()` method
2. Integrate into `translate()` flow
3. Add error handling and logging
4. Write unit tests for verification logic

### Phase 2: Cleanup

5. Remove puppeteer-real-browser references
6. Update comments and docs
7. Clean up unused code

### Phase 3: Humanizer Enhancements

8. Implement bezier mouse curves
9. Implement burst typing with mistakes
10. Add variable delays and jitter
11. Test humanizer improvements

### Phase 4: Testing

12. Write integration tests
13. Write E2E tests
14. Achieve full coverage
15. Manual QA on local + Docker

### Phase 5: Documentation

16. Update README
17. Add troubleshooting guide
18. Document architecture changes

---

## 16. Observability

### Logging Strategy

**Startup:**

```
[kagi-session] Loading cookies from /app/secrets/kagi-session.json
[kagi-session] Opening https://kagi.com then injecting 3 cookie(s)
✅ Login verification passed
```

**Verification Success:**

```
✅ Login verification passed
```

**Verification Failure:**

```
❌ Login verification failed: redirected to https://kagi.com/signin
Error: Session cookies invalid or expired. Update KAGI_SESSION_FILE.
```

**Humanizer Actions:**

```
⚙️  Clicking Translation Settings…
⚙️  Clicking formality "Vietnamese Formal"…
[reading-level] Setting "intermediate" -> step 3
```

### Metrics (Future)

- Translation success rate
- Login verification pass/fail rate
- Average translation duration
- Humanizer action timings

---

## 17. Open Risks

### 🔴 HIGH RISK (Must Address Before Deployment)

- **[UNCONFIRMED]** Login verification logic not yet implemented
  - **Mitigation:** Implement in Phase 1, test with valid/invalid cookies

### 🟡 MEDIUM RISK

- **Humanizer changes may break existing timing assumptions**
  - **Mitigation:** Incremental testing, adjust delays after each improvement
- **Full test coverage will require significant time investment**
  - **Mitigation:** Prioritize critical path tests, parallelize test writing

- **Bezier mouse curves may introduce new edge cases**
  - **Mitigation:** Fallback to linear movement on failure, extensive testing

### 🟢 LOW RISK

- **README updates may be incomplete**
  - **Mitigation:** Review with user after draft

---

## 18. Trade-offs

### Decision: Fail-Fast on Login Verification

**Chosen:** Throw error immediately, no retry  
**Alternative:** Retry 2-3 times before failing  
**Rationale:**

- Cookie expiry is deterministic (not transient network issue)
- Retrying won't fix an expired cookie
- Fail-fast gives immediate feedback to user
- Simpler code, no retry logic complexity

### Decision: Navigate to /settings for Verification

**Chosen:** Check redirect behavior on `/settings` page  
**Alternative:** Check for specific element (e.g., account menu)  
**Rationale:**

- Redirect is reliable signal (Kagi always redirects unauthenticated users)
- Element-based check could be flaky (UI changes)
- /settings is stable endpoint unlikely to change
- URL check is faster than DOM query

### Decision: Bezier Curves for All Mouse Movements

**Chosen:** Implement curves for click() and dragSlider()  
**Alternative:** Only for high-risk actions (e.g., Cloudflare bypass)  
**Rationale:**

- Consistent human-like behavior across all actions
- Slight performance cost acceptable (< 100ms per action)
- Easier to maintain one code path
- Better defense against sophisticated anti-bot systems

### Decision: Full Test Coverage

**Chosen:** Unit + Integration + E2E for all new/modified code  
**Alternative:** Only E2E for critical path  
**Rationale:**

- User requirement: full coverage
- Unit tests catch regressions early
- Integration tests verify service boundaries
- E2E tests catch real-world issues
- Investment pays off in maintenance phase

---

## 19. Future Scope / Deferred Features

_The following were confirmed as out-of-scope for this migration:_

### Authentication Improvements

- Automatic cookie refresh mechanism
- Manual login flow (Playwright interactive mode)
- Support for username/password login
- Session renewal on expiry

### Humanizer Enhancements (Beyond Current Scope)

- Machine learning-based typing patterns
- Mouse movement heatmap analysis
- Screen reader simulation
- Copy-paste behavior (mix typing + paste)

### Testing Infrastructure

- Visual regression testing (screenshot comparison)
- Performance benchmarking suite
- Chaos testing (random network failures)

### Monitoring & Alerting

- Prometheus metrics export
- Grafana dashboards
- PagerDuty integration for failures

---

## 20. Acceptance Criteria (Summary)

### Functional Requirements

- ✅ Login verification works (success: proceed, failure: throw)
- ✅ Translate flow completes end-to-end with valid cookies
- ✅ Invalid cookies trigger immediate error before translate
- ✅ Humanizer behavior includes 3 enhancements (random, typing, curves)

### Quality Requirements

- ✅ Zero puppeteer-real-browser references in code
- ✅ All linter checks pass
- ✅ All type checks pass
- ✅ Code coverage ≥ 80% for modified code

### Testing Requirements

- ✅ All unit tests pass (services, utils, config)
- ✅ All integration tests pass (browser flow, login verification)
- ✅ All E2E tests pass (happy path + edge cases)
- ✅ Manual smoke test on local dev environment
- ✅ Manual smoke test on Docker environment

### Documentation Requirements

- ✅ README updated with cookie setup instructions
- ✅ README includes troubleshooting section
- ✅ Code comments added for complex logic (verification, humanizer)
- ✅ No outdated references to puppeteer-real-browser

### Deployment Requirements

- ✅ Works in local dev (macOS/Linux)
- ✅ Works in Docker (headless mode)
- ✅ No breaking changes to existing env vars
- ✅ Backward compatible for users not using cookies (throws clear error)

---

## 21. Explicit Decisions Made

### [DEC-001] Login Verification Location

**Decision:** Implement verification in translate() method, after cookie injection  
**Status:** accepted  
**Provenance:** user-confirmed  
**Risk:** low  
**Notes:** Centralized in single method, runs before every translate operation

### [DEC-002] Failure Handling Strategy

**Decision:** Fail-fast on login verification failure (no retry)  
**Status:** accepted  
**Provenance:** user-stated  
**Risk:** low  
**Notes:** Cookie expiry is deterministic, retry would not help

### [DEC-003] Verification Success Criteria

**Decision:** Check if URL === "https://kagi.com/settings" after navigation  
**Status:** accepted  
**Provenance:** user-stated  
**Risk:** low  
**Notes:** Redirect behavior is reliable signal for auth status

### [DEC-004] Humanizer Scope

**Decision:** Implement 3 improvements: randomness, typing, mouse curves  
**Status:** accepted  
**Provenance:** user-confirmed  
**Risk:** medium  
**Notes:** May affect existing timing assumptions, requires testing

### [DEC-005] Test Coverage Level

**Decision:** Full coverage (unit + integration + E2E)  
**Status:** accepted  
**Provenance:** user-selected  
**Risk:** low  
**Notes:** Time investment justified by quality requirements

### [DEC-006] Documentation Scope

**Decision:** Update README only (no separate migration guide)  
**Status:** accepted  
**Provenance:** user-selected  
**Risk:** low  
**Notes:** Internal project, no external users

### [DEC-007] Cleanup Strategy

**Decision:** Check code first, then remove all puppeteer-real-browser references  
**Status:** accepted  
**Provenance:** user-confirmed  
**Risk:** low  
**Notes:** Comprehensive cleanup ensures no confusion for future developers

### [DEC-008] Deployment Environments

**Decision:** Support both local dev and Docker  
**Status:** accepted  
**Provenance:** user-selected  
**Risk:** low  
**Notes:** Existing pattern, no changes to environment handling

---

## Appendix A: Coverage Matrix

| Domain                   | Status       | Last Updated | Notes                                                             |
| ------------------------ | ------------ | ------------ | ----------------------------------------------------------------- |
| Objective                | resolved     | Turn 3       | Verify, improve, test, document                                   |
| Definition of Done       | resolved     | Turn 3       | Functional + quality + testing + docs criteria                    |
| Scope                    | resolved     | Turn 8       | Login verification, cleanup, humanizer, tests, docs               |
| Non-goals                | resolved     | Turn 3       | Backward compat, CI/CD, other browsers                            |
| Constraints              | resolved     | Turn 12      | TypeScript, Bun, patchright, secrets via filesystem               |
| Environment              | resolved     | Turn 12      | Local dev + Docker support                                        |
| Dependencies             | resolved     | Turn 13      | No additional constraints                                         |
| Risk/Safety              | resolved     | Turn 7       | Login verification critical, humanizer timing risk                |
| Technical Implementation | resolved     | Turn 10      | verifyLoginSuccess() method, HumanInteractionService enhancements |
| UI/UX                    | out-of-scope | Turn 3       | Backend automation, no user-facing UI                             |
| Data Model               | resolved     | Turn 9       | KagiSessionJsonFile schema                                        |
| Business Rules           | resolved     | Turn 5-7     | Login verification mandatory, fail-fast, URL-based check          |
| Edge Cases               | resolved     | Turn 11      | Login redirects, humanizer edge cases, browser crashes            |
| Error Handling           | resolved     | Turn 7       | Fail-fast, clear messages, no retry                               |
| State Transitions        | resolved     | Turn 10      | LOGIN_VERIFIED state added to flow                                |
| Testing                  | resolved     | Turn 11      | Full unit + integration + E2E coverage                            |
| Deployment               | resolved     | Turn 12      | Local + Docker, no CI/CD changes                                  |
| Observability            | resolved     | Turn 15      | Logging strategy for verification success/failure                 |
| Performance              | resolved     | Turn 10      | Optimize delays, profile hot paths                                |
| Security/Compliance      | out-of-scope | Turn 13      | Cookie files managed by user, no secret manager                   |
| Analytics/Telemetry      | out-of-scope | Turn 15      | Future scope (metrics/dashboards)                                 |
| DX/Tooling               | resolved     | Turn 3       | Bun test, existing linter/typecheck                               |

---

## Appendix B: Scope Boundary Log

_Items explicitly confirmed as out-of-scope during interview:_

1. **Backward compatibility with puppeteer-real-browser** - Not needed, fresh start
2. **Migration guide for external users** - Internal project only
3. **CI/CD pipeline changes** - Not in scope for this work
4. **Browser binary management changes** - Current logic sufficient
5. **Additional browser support** - Chromium only via patchright
6. **Automatic cookie refresh** - User responsible for valid cookies
7. **Manual login flow** - Out of scope, too complex
8. **Secret manager integration** - Filesystem approach sufficient

---

## Appendix C: Scope Extension Backlog

_Features/ideas confirmed as NOT in current scope (for future consideration):_

### Authentication Enhancements

- Auto-detect cookie expiry and notify user proactively
- Support OAuth flow for Kagi authentication
- Implement session renewal mechanism

### Humanizer Advanced Features

- ML-based typing pattern generation
- Viewport-aware mouse movement (avoid edges)
- Randomized "distraction" events (mouse drift, window switches)

### Testing Infrastructure

- Property-based testing (QuickCheck-style)
- Mutation testing for test quality validation
- Automated visual regression testing

### Monitoring & Alerting

- Real-time metrics dashboard
- Slack/email notifications for failures
- Historical success rate tracking

### Developer Experience

- Hot-reload for development mode
- Interactive debugger for failed translations
- Better error messages with suggested fixes

_Note: These items are deferred and have not been estimated or committed to any timeline._
