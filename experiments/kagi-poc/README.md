# Kagi Translate PoC

Proof of Concept for automating Kagi Translate using Playwright with stealth and human-like behavior.

## Setup

### Install Dependencies

```bash
bun install
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env` if needed:

```env
HEADLESS=false    # Recommended for debugging Cloudflare challenges
```

## Usage

### Phase 2: Basic Translation (JP→VI)

```bash
bun start
```

### Phase 3: Advanced (All Settings via Env)

```bash
TEXT="こんにちは" SOURCE_LANG=ja TARGET_LANG=vi bun start:advanced
```

### With Formality

```bash
TEXT="ありがとうございます" SOURCE_LANG=ja TARGET_LANG=vi FORMALITY=more bun start:advanced
```

## Cloudflare Bypass Strategy

This PoC uses **playwright-extra + stealth + human-like behavior**:

- Random user agents (3 realistic profiles)
- Mouse movements with realistic speeds
- Random scrolling and delays
- Realistic browser context (viewport, locale, timezone)
- Anti-detection launch arguments

### Current Limitations

Kagi Translate uses Cloudflare Turnstile protection which is aggressive against automated browsers. The current implementation uses best-effort stealth techniques but may still be blocked.

**If you encounter Cloudflare challenges:**

1. Run with `HEADLESS=false` to see what's happening
2. Check debug screenshots: `debug-*.png`
3. Consider these alternatives:
   - Use Kagi's official API (if available)
   - Integrate paid captcha services (2captcha, CapMonster)
   - Use browser extension-based approaches
   - Manual verification workflow

## Architecture

```
┌─────────────────────────────────────────┐
│  Bun/TypeScript (translator.ts)        │
│  ┌─────────────────────────────────┐   │
│  │ playwright-extra                │   │
│  │ + puppeteer-extra-stealth       │   │
│  │ + human-like behavior           │   │
│  │   - Random UA rotation          │   │
│  │   - Mouse movements             │   │
│  │   - Scrolling & delays          │   │
│  └─────────────────────────────────┘   │
│              ▼                          │
│  ┌─────────────────────────────────┐   │
│  │ Chromium (headed mode)          │   │
│  │ Navigate → Extract → Return     │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Tech Stack

- **Bun** v1.1+ (JavaScript runtime)
- **TypeScript** 5.4+ (strict mode)
- **Playwright** ^1.52 (browser automation)
- **playwright-extra** ^4.3.6 (plugin system)
- **puppeteer-extra-plugin-stealth** ^2.11.2 (anti-detection)

## Development

### Type Check

```bash
bun run typecheck
```

### Run Tests

```bash
bun test
```

## Troubleshooting

### Cloudflare Still Blocking

1. Ensure running in headed mode: `HEADLESS=false`
2. Check debug screenshots for visual diagnosis
3. Increase delays in `humanLikeBehavior()` function
4. Try different user agents
5. Consider using residential proxies

### No Translation Output

Check the screenshot files to see:

- Is Cloudflare challenge appearing?
- Is the page loading correctly?
- What selectors are present?

If the output element selector changed, update `OUTPUT_SELECTORS` in `src/extractor.ts`.

## License

Internal research project.
