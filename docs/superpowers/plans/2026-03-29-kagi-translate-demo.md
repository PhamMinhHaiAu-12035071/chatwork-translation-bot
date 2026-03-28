# Kagi Translate API Demo - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a single-file Bun.js demo that translates hardcoded English text to Vietnamese using Kagi Translate API with experimental authentication (fake session token).

**Architecture:** Single TypeScript file using native Bun fetch API, no external dependencies, minimal payload approach based on successful Postman test.

**Tech Stack:**

- Bun runtime (v1.1+)
- Native fetch API (WHATWG standard)
- TypeScript for type safety
- No external packages

---

## File Structure

**Files to create:**

- `examples/kagi-translate-demo.ts` - Main demo script (~80 lines)

**Files to reference:**

- `kagi_translate_api_report.md` - API documentation research
- `docs/brainstorms/2026-03-29-kagi-translate-demo-brainstorm.md` - Design decisions

---

## Task 1: Create Demo File with Constants and Types

**Files:**

- Create: `examples/kagi-translate-demo.ts`

- [ ] **Step 1: Create file with header comment and imports**

```typescript
/**
 * Kagi Translate API Demo (Experimental)
 *
 * Proof-of-concept using fake session token approach.
 * Based on successful Postman test with session_token="e".
 *
 * NOT FOR PRODUCTION - API may reject this approach anytime.
 *
 * Usage: bun examples/kagi-translate-demo.ts
 */

// No imports needed - using Bun built-ins only
```

- [ ] **Step 2: Define TypeScript types**

```typescript
/**
 * Kagi Translate API Request Payload (minimal subset)
 */
interface TranslateRequest {
  text: string
  from: string
  to: string
  stream: boolean
  session_token: string
  translation_style: 'natural' | 'literal'
  formality: 'default' | 'formal' | 'informal' | 'prefer_more' | 'prefer_less'
}

/**
 * Kagi Translate API Response (non-streaming)
 */
interface TranslateResponse {
  translation?: string
  detectedLanguage?: {
    iso: string
    label: string
  }
  error?: string
  details?: Array<{
    field: string
    message: string
  }>
}
```

- [ ] **Step 3: Define constants**

```typescript
// API Configuration
const KAGI_TRANSLATE_ENDPOINT = 'https://translate.kagi.com/api/translate'

// Demo Input
const DEMO_TEXT = "Hello, how are you today? I hope you're having a wonderful day!"
const SOURCE_LANGUAGE = 'en'
const TARGET_LANGUAGE = 'vi'

// Experimental: fake session token (based on successful Postman test)
const FAKE_SESSION_TOKEN = 'demo'
```

- [ ] **Step 4: Verify file exists**

Run: `ls -la examples/kagi-translate-demo.ts`  
Expected: File exists with ~50 lines

- [ ] **Step 5: Commit**

```bash
git add examples/kagi-translate-demo.ts
git commit -m "feat: add kagi translate demo skeleton with types and constants"
```

---

## Task 2: Implement Translation Function

**Files:**

- Modify: `examples/kagi-translate-demo.ts`

- [ ] **Step 1: Add translateText function**

```typescript
/**
 * Translate text using Kagi Translate API (experimental approach)
 */
async function translateText(text: string, from: string, to: string): Promise<TranslateResponse> {
  // Construct minimal payload
  const payload: TranslateRequest = {
    text,
    from,
    to,
    stream: false, // Non-streaming for simplicity
    session_token: FAKE_SESSION_TOKEN,
    translation_style: 'natural',
    formality: 'default',
  }

  // Make POST request
  const response = await fetch(KAGI_TRANSLATE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  // Check HTTP status
  if (!response.ok) {
    const errorText = await response.text()
    let errorData: TranslateResponse

    try {
      errorData = JSON.parse(errorText)
    } catch {
      errorData = { error: `HTTP ${response.status}: ${errorText}` }
    }

    return errorData
  }

  // Parse JSON response
  const data: TranslateResponse = await response.json()
  return data
}
```

- [ ] **Step 2: Verify syntax**

Run: `bun --print 'console.log("Syntax check")' && echo "✓ TypeScript valid"`  
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add examples/kagi-translate-demo.ts
git commit -m "feat: implement translateText function with minimal payload"
```

---

## Task 3: Add Display and Error Handling Functions

**Files:**

- Modify: `examples/kagi-translate-demo.ts`

- [ ] **Step 1: Add display result function**

```typescript
/**
 * Display translation result with pretty formatting
 */
function displayResult(
  input: string,
  output: string | undefined,
  sourceLang: string,
  targetLang: string,
  detectedLang?: { iso: string; label: string },
): void {
  console.log('\n' + '━'.repeat(60))
  console.log('🌐 Kagi Translate Demo (Experimental)')
  console.log('━'.repeat(60) + '\n')

  console.log(`📝 Input (${sourceLang}):`)
  console.log(`   ${input}\n`)

  if (detectedLang && detectedLang.iso !== sourceLang) {
    console.log(`🔍 Detected: ${detectedLang.label} (${detectedLang.iso})\n`)
  }

  console.log(`🔄 Translation (${targetLang}):`)
  if (output) {
    console.log(`   ${output}\n`)
    console.log('✅ Success!')
  } else {
    console.log('   ❌ No translation returned\n')
  }

  console.log('━'.repeat(60) + '\n')
}
```

- [ ] **Step 2: Add error display function**

```typescript
/**
 * Display error with helpful context
 */
function displayError(error: unknown, response?: TranslateResponse): void {
  console.log('\n' + '━'.repeat(60))
  console.log('❌ Translation Failed')
  console.log('━'.repeat(60) + '\n')

  if (response?.error) {
    console.log(`Error: ${response.error}`)

    if (response.details) {
      console.log('\nDetails:')
      for (const detail of response.details) {
        console.log(`  - ${detail.field}: ${detail.message}`)
      }
    }
  } else if (error instanceof Error) {
    console.log(`Error: ${error.message}`)
  } else {
    console.log(`Error: ${String(error)}`)
  }

  console.log('\n💡 Troubleshooting:')
  console.log('  1. Check internet connection')
  console.log('  2. Verify API endpoint is accessible')
  console.log('  3. Try different session_token value')
  console.log('  4. Check if rate limited (wait 60s)')
  console.log('\n' + '━'.repeat(60) + '\n')
}
```

- [ ] **Step 3: Commit**

```bash
git add examples/kagi-translate-demo.ts
git commit -m "feat: add display and error handling functions"
```

---

## Task 4: Implement Main Entry Point

**Files:**

- Modify: `examples/kagi-translate-demo.ts`

- [ ] **Step 1: Add main function**

```typescript
/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('\n🚀 Starting Kagi Translate Demo...\n')
  console.log(`   Text: "${DEMO_TEXT}"`)
  console.log(`   From: ${SOURCE_LANGUAGE}`)
  console.log(`   To: ${TARGET_LANGUAGE}`)
  console.log(`   Session Token: ${FAKE_SESSION_TOKEN} (fake)\n`)
  console.log('⏳ Translating...')

  try {
    const result = await translateText(DEMO_TEXT, SOURCE_LANGUAGE, TARGET_LANGUAGE)

    // Check for API error in response
    if (result.error) {
      displayError(new Error('API returned error'), result)
      process.exit(1)
    }

    // Display successful translation
    displayResult(
      DEMO_TEXT,
      result.translation,
      SOURCE_LANGUAGE,
      TARGET_LANGUAGE,
      result.detectedLanguage,
    )
  } catch (error) {
    displayError(error)
    process.exit(1)
  }
}

// Run main function
await main()
```

- [ ] **Step 2: Make file executable (optional)**

Run: `chmod +x examples/kagi-translate-demo.ts`  
Expected: File has execute permissions

- [ ] **Step 3: Commit**

```bash
git add examples/kagi-translate-demo.ts
git commit -m "feat: add main entry point and execution flow"
```

---

## Task 5: Test the Demo

**Files:**

- Test: `examples/kagi-translate-demo.ts`

- [ ] **Step 1: Run the demo**

Run: `bun examples/kagi-translate-demo.ts`  
Expected: Either successful translation output OR clear error message

- [ ] **Step 2: Verify output format**

Check console output contains:

- ✓ Header with emoji decorators
- ✓ Input text display
- ✓ Translation result (if successful) OR error details (if failed)
- ✓ Footer with separators

- [ ] **Step 3: Document actual results**

Create a note about what happened:

- Did it work with fake session token?
- What error code if any?
- What response was received?

---

## Task 6: Add README Documentation

**Files:**

- Create: `examples/README.md` (or update if exists)

- [ ] **Step 1: Create documentation**

````markdown
# Kagi Translate Demo

Experimental proof-of-concept for using Kagi Translate API without official authentication.

## ⚠️ Important Notice

This demo uses an **experimental approach** with a fake session token. It is:

- ❌ **NOT officially supported** by Kagi
- ❌ **NOT suitable for production**
- ❌ **May break at any time**
- ✅ **For research/learning only**

For production use, get an official API key from [kagi.com/settings/api](https://kagi.com/settings/api).

## Usage

```bash
# Run the demo
bun examples/kagi-translate-demo.ts
```
````

## What It Does

Translates this hardcoded English text to Vietnamese:

```
"Hello, how are you today? I hope you're having a wonderful day!"
```

Using minimal API payload:

- No official API key
- Fake session_token
- Non-streaming response
- Basic error handling

## Expected Results

### If Successful ✅

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Kagi Translate Demo (Experimental)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Input (en):
   Hello, how are you today? I hope you're having a wonderful day!

🔄 Translation (vi):
   Xin chào, hôm nay bạn thế nào? Tôi hy vọng bạn đang có một ngày tuyệt vời!

✅ Success!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### If Failed ❌

Common errors:

- **401 Unauthorized**: Session token rejected
- **422 Validation Error**: Invalid parameters
- **429 Rate Limited**: Too many requests
- **Network Error**: Connection issues

## Customization

Edit constants in `kagi-translate-demo.ts`:

```typescript
const DEMO_TEXT = 'Your text here'
const SOURCE_LANGUAGE = 'en' // ISO 639-1 code
const TARGET_LANGUAGE = 'vi' // ISO 639-1 code
const FAKE_SESSION_TOKEN = 'demo' // Try: "e", "test", "anonymous"
```

## Research Background

Based on reverse engineering documented in:

- `kagi_translate_api_report.md` - Full API analysis
- `docs/brainstorms/2026-03-29-kagi-translate-demo-brainstorm.md` - Design decisions

User's Postman test showed `session_token="e"` worked, suggesting minimal validation for simple requests.

## Troubleshooting

### Error: ECONNREFUSED

→ Check internet connection and DNS

### Error: 401 Unauthorized

→ Try different session_token values: "e", "test", "anonymous", ""

### Error: 429 Rate Limited

→ Wait 60 seconds before retrying

### Error: Unexpected response format

→ Run with verbose logging to inspect actual response

````

- [ ] **Step 2: Verify README exists**

Run: `cat examples/README.md | head -20`
Expected: README with warning and usage instructions

- [ ] **Step 3: Commit**

```bash
git add examples/README.md
git commit -m "docs: add README for kagi translate demo"
````

---

## Task 7: Final Verification and Cleanup

**Files:**

- Test: All created files

- [ ] **Step 1: Run type check**

Run: `bun run typecheck`  
Expected: No TypeScript errors in examples/kagi-translate-demo.ts

- [ ] **Step 2: Run linter**

Run: `bun run lint`  
Expected: No lint errors (or acceptable warnings)

- [ ] **Step 3: Test demo one more time**

Run: `bun examples/kagi-translate-demo.ts`  
Expected: Clean output, no crashes

- [ ] **Step 4: Verify file structure**

Run: `ls -la examples/`  
Expected:

- `kagi-translate-demo.ts` (~150-200 lines)
- `README.md` (documentation)

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "chore: final verification and cleanup for kagi demo"
```

---

## Success Criteria

✅ **Minimum Success** (even if translation fails):

- [x] Demo file runs without crash
- [x] Makes HTTP request to Kagi API
- [x] Handles errors gracefully
- [x] Displays clear output

✅ **Ideal Success**:

- [x] Receives HTTP 200 from API
- [x] Gets Vietnamese translation
- [x] No authentication errors
- [x] Clean, formatted output

✅ **Documentation**:

- [x] README with usage instructions
- [x] Warning about experimental nature
- [x] Troubleshooting guide

---

## Notes for Execution

**If translation succeeds:**

- 🎉 Awesome! Document the working session_token value
- Test with different input text to verify stability
- Consider adding more language pairs

**If translation fails with 401:**

- Try different session_token values: `"e"`, `"test"`, `"anonymous"`, `""`
- Check if omitting session_token entirely works
- Consider adding WASM headers as fallback

**If rate limited (429):**

- Add delay between requests
- Document the rate limit threshold
- Consider caching results

**If unexpected response:**

- Log full response body
- Update TypeScript types to match
- Adjust field extraction logic

---

## Execution Handoff

**Plan complete!** Two execution options:

**1. Subagent-Driven (recommended)** - Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach would you like?
