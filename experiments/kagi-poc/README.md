# Kagi Translate PoC

Simple proof-of-concept to open Kagi Translate using `puppeteer-real-browser`.

## Features

- ✅ Uses latest `puppeteer-real-browser` (1.4.4)
- ✅ Turnstile auto-bypass enabled (`turnstile: true`)
- ✅ Headed mode (browser visible for debugging)
- ✅ Single file implementation (~30 lines)
- ✅ Minimal configuration (no complex args or plugins needed)

## Setup

```bash
bun install
```

## Run

```bash
bun start
```

Or with watch mode:

```bash
bun dev
```

## How It Works

1. Connects to Chromium using `puppeteer-real-browser`
2. Applies stealth plugins to avoid bot detection
3. Navigates to `https://translate.kagi.com/`
4. Keeps browser open for 10 seconds
5. Closes automatically

## Dependencies

- **puppeteer-real-browser** ^1.4.4 - Real browser automation with built-in Turnstile bypass

## Notes

- Turnstile bypass is enabled but Kagi's implementation is aggressive
- This is for educational/research purposes only
- Headed mode (`headless: false`) is recommended for debugging
