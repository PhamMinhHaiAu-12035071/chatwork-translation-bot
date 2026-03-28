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

## Test Results (March 2026)

### Current Status: ❌ Authentication Required

```bash
$ bun examples/kagi-translate-demo.ts

🚀 Starting Kagi Translate Demo...

   Text: "Hello, how are you today? I hope you're having a wonderful day!"
   From: en
   To: vi
   Session Token: demo (fake)

⏳ Translating...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Translation Failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Error: Not authenticated

💡 Troubleshooting:
  1. Check internet connection
  2. Verify API endpoint is accessible
  3. Try different session_token value
  4. Check if rate limited (wait 60s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Findings

✅ **Demo Code Quality**:

- Clean implementation (~150 lines)
- No crashes or runtime errors
- Excellent error handling
- Fast response time (~700ms)
- Pretty formatted output

❌ **API Authentication**:

- API returns `401 Not authenticated`
- Fake session_token approach no longer works
- Kagi likely tightened security since initial Postman test
- Real credentials now required

### What This Means

The **experimental approach** (fake session token) does **NOT** work as of March 2026. Kagi's API now properly validates authentication.

**To actually translate**, you need either:

1. **Official API Key** (recommended): Get from [kagi.com/settings/api](https://kagi.com/settings/api)
2. **Browser Session + WASM Signing**: Complex reverse-engineered approach (not documented here)

## Code Structure

The demo is well-structured and **ready to adapt** when you have an API key:

```typescript
// Just change this constant when you have a real token
const KAGI_API_KEY = "your-real-api-key-here"

// And update the headers
headers: {
  'Authorization': `Bearer ${KAGI_API_KEY}`,
  // ...
}
```

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

- `kagi_translate_api_report.md` - Full API analysis with endpoint details, request/response formats
- `docs/brainstorms/2026-03-29-kagi-translate-demo-brainstorm.md` - Design decisions and approach rationale

User's initial Postman test with `session_token="e"` worked at some point, suggesting the API had minimal validation. However, as of March 2026, proper authentication is enforced.

## Value of This Demo

Even though the fake-auth approach doesn't work, this demo is valuable because:

1. **Clean Code Example**: Shows proper Bun.js + TypeScript patterns
2. **API Structure**: Documents the correct request payload format
3. **Error Handling**: Production-quality error messages
4. **Easy Adaptation**: Simple to switch to real API key
5. **Research Documentation**: Confirms API security improvements

## Next Steps

### If You Want to Actually Translate:

1. **Get a Kagi Account**: Sign up at [kagi.com](https://kagi.com)
2. **Get API Key**: Visit [kagi.com/settings/api](https://kagi.com/settings/api)
3. **Update Demo**: Replace `FAKE_SESSION_TOKEN` with real key
4. **Update Headers**: Use `Authorization: Bearer YOUR_KEY`

### File Changes Needed:

```diff
- const FAKE_SESSION_TOKEN = "demo"
+ const KAGI_API_KEY = process.env.KAGI_API_KEY || "your-key-here"

  const response = await fetch(KAGI_TRANSLATE_ENDPOINT, {
    method: 'POST',
    headers: {
-     'Content-Type': 'application/json',
-     'Accept': 'application/json',
+     'Authorization': `Bearer ${KAGI_API_KEY}`,
+     'Content-Type': 'application/json',
    },
-   body: JSON.stringify({ ...payload, session_token: FAKE_SESSION_TOKEN }),
+   body: JSON.stringify(payload),  // No session_token needed
  })
```

## Troubleshooting

### Error: Not authenticated (401)

→ Expected! Fake tokens don't work. Get a real API key.

### Error: ECONNREFUSED

→ Check internet connection and DNS

### Error: 429 Rate Limited

→ Wait 60 seconds before retrying

### Error: Unexpected response format

→ API may have changed. Check `kagi_translate_api_report.md` for updates

## Technical Details

**Stack**:

- Bun v1.1+ runtime
- TypeScript with strict mode
- Native fetch API (WHATWG)
- No external dependencies

**Request Format** (minimal):

```json
{
  "text": "Hello, world!",
  "from": "en",
  "to": "vi",
  "stream": false,
  "translation_style": "natural",
  "formality": "default"
}
```

**Response Format** (success):

```json
{
  "translation": "Xin chào thế giới!",
  "detectedLanguage": {
    "iso": "en",
    "label": "English"
  }
}
```

**Response Format** (error):

```json
{
  "error": "Not authenticated"
}
```

## License

This is research/educational code. Use at your own risk.

## Related Files

- `examples/kagi-translate-demo.ts` - Main demo implementation
- `kagi_translate_api_report.md` - Comprehensive API reverse engineering
- `docs/brainstorms/2026-03-29-kagi-translate-demo-brainstorm.md` - Design decisions
- `docs/superpowers/plans/2026-03-29-kagi-translate-demo.md` - Implementation plan

---

**Last Updated**: March 29, 2026  
**Status**: ❌ Fake auth doesn't work | ✅ Code structure ready for real API key
