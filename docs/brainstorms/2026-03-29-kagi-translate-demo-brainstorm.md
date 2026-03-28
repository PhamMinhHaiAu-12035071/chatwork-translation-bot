---
date: 2026-03-29
topic: kagi-translate-bun-demo
---

# Kagi Translate API - Bun.js Demo (Experimental)

## What We're Building

A minimal proof-of-concept Bun.js script that translates hardcoded English text to Vietnamese using Kagi's Translate API endpoint, bypassing official authentication by using a fake session token (experimental approach).

**Goal**: Verify that the API endpoint can be called without a real Kagi account, based on successful Postman test with `session_token="e"`.

## Why This Approach

### Context from Research

The research report (`kagi_translate_api_report.md`) reveals two paths:

1. **Official Path**: `Authorization: Bearer <API_KEY>` - requires Kagi account
2. **Browser Path**: Complex WASM signing with many headers - used by web UI

**User's Discovery**: Postman test succeeded with minimal payload and `session_token="e"` (random string). This suggests the API may not strictly validate session tokens for simple translation requests.

### Chosen Approach: Experimental Minimal

- **No API key required** - test if fake session_token works
- **No WASM signing** - skip complex X-\* headers
- **Minimal payload** - only essential fields
- **Non-streaming** - simpler response parsing
- **Single file** - no abstractions, straightforward POC

**Trade-off Accepted**: This may break anytime. Not for production. Purely exploratory.

## Key Decisions

### 1. Session Token Strategy

**Decision**: Use `"demo"` as hardcoded fake token

**Rationale**:

- User's Postman test with `session_token="e"` worked
- Suggests API doesn't validate this field strictly (at least for unauthenticated requests)
- Simple strings appear sufficient for POC

**Fallback**: If fails, try other values: `"test"`, `"anonymous"`, empty string, or omit field entirely

### 2. Streaming vs Non-Streaming

**Decision**: `stream: false` (JSON response)

**Rationale**:

- Simpler parsing (single JSON object vs SSE event stream)
- Easier error handling
- Sufficient for POC with short text
- Can always upgrade to streaming later

**Alternative**: `stream: true` would give real-time delta chunks (SSE) - useful for long translations but adds complexity

### 3. Required vs Optional Fields

**Decision**: Include minimal required + sane defaults

**Core Required** (from OpenAPI):

- `text`: The input string
- `source_lang` or `from`: Source language (use `"en"`)
- `target_lang` or `to`: Target language (use `"vi"`)

**Included for Stability**:

- `stream: false`: Explicit format preference
- `session_token: "demo"`: Based on user's successful test
- `translation_style: "natural"`: Default style
- `formality: "default"`: Standard tone

**Omitted** (to keep minimal):

- `model`: Not needed for standard quality
- `language_complexity`: Default is fine
- `context`: Empty/omitted for simple demo
- `speaker_gender` / `addressee_gender`: Default unknown
- All WASM signing headers (X-Request-Signature, etc.)

### 4. Error Handling Strategy

**Decision**: Basic try/catch with informative messages

**Levels**:

1. **Network errors**: Catch fetch rejection
2. **HTTP errors**: Check response.ok, log status
3. **Parse errors**: Catch JSON.parse failures
4. **API errors**: Check for error field in response

**Not handling** (acceptable for POC):

- Rate limiting (429) with retry logic
- Partial failures
- Timeout configuration

### 5. Input/Output Format

**Input**: Hardcoded const in code

```typescript
const INPUT_TEXT = 'Hello, how are you today?'
const SOURCE_LANG = 'en'
const TARGET_LANG = 'vi'
```

**Output**: Terminal console with emoji decorators

- Show input text
- Show translation result
- Show any errors clearly

## Technical Architecture

### Single File Structure

```typescript
// kagi-translate-demo.ts

// 1. Constants
const ENDPOINT = 'https://translate.kagi.com/api/translate'
const INPUT_TEXT = '...'

// 2. Main translate function
async function translateText() {
  // Construct payload
  // Fetch POST
  // Parse response
  // Extract translation
  // Return result
}

// 3. Pretty print function
function displayResult(input, output, lang) {
  // Format console output with emojis
}

// 4. Error handler
function handleError(error) {
  // User-friendly error messages
}

// 5. Entry point
await translateText()
```

### Request Payload (Minimal)

```typescript
{
  text: INPUT_TEXT,
  from: "en",                    // or source_lang
  to: "vi",                      // or target_lang
  stream: false,                 // JSON response
  session_token: "demo",         // Fake token
  translation_style: "natural",  // Natural translation
  formality: "default"           // Standard formality
}
```

### Expected Response (Non-Streaming)

Success (HTTP 200):

```json
{
  "translation": "Xin chào, bạn khỏe không?",
  "detectedLanguage": {
    "iso": "en",
    "label": "English"
  }
}
```

Possible Errors:

- **401**: `{"error": "Not authenticated"}` - session token rejected
- **422**: `{"error": "Validation failed", "details": [...]}` - invalid params
- **429**: `{"error": "Rate limit exceeded"}` - too many requests
- **500**: `{"error": "Internal server error"}` - server issue

### Dependencies

**None** - uses only Bun built-ins:

- `fetch()` - HTTP client (WHATWG standard)
- `JSON` - Built-in parser
- `console` - Terminal output

## Implementation Plan Summary

### File to Create

- `kagi-translate-demo.ts` (root of project or in `examples/`)

### Core Steps

1. Define constants (endpoint, text, languages)
2. Create payload object
3. Fetch POST with JSON body
4. Check response.ok
5. Parse JSON
6. Extract translation field
7. Display result
8. Wrap in try/catch

### Testing Strategy

1. Run: `bun kagi-translate-demo.ts`
2. Verify translation appears
3. Test with different input text
4. Document any errors encountered

## Open Questions

❓ **Will fake session_token continue to work?**

- User's test succeeded, but API may change validation
- Fallback: Try different token values or empty string

❓ **Will we get rate limited quickly?**

- Anonymous requests have stricter limits per research
- Mitigation: Don't spam requests, add delays if testing multiple translations

❓ **What if response format differs from OpenAPI docs?**

- Log full response for inspection
- Adjust field extraction based on actual response

## Success Criteria

✅ **Minimum Success**:

- Script runs without crash
- Makes HTTP request to Kagi API
- Receives any response (even if error)
- Logs response clearly

✅ **Ideal Success**:

- Receives HTTP 200
- Parses translation field
- Displays Vietnamese translation of English input
- No authentication errors

✅ **Stretch Goal**:

- Works reliably across multiple runs
- Handles common errors gracefully
- Can be easily adapted to different languages/text

## Next Steps

1. **Write implementation plan** with step-by-step tasks
2. **Create the demo file** following the plan
3. **Test and iterate** based on actual API behavior
4. **Document findings** - what worked, what didn't, any surprises

---

**Note**: This is an experimental POC to test an undocumented approach. Not suitable for production use. Official API key method is recommended for real applications.
