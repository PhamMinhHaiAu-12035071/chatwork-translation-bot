# Kagi Translate PoC

Proof of Concept for automating Kagi Translate using Playwright with Cloudflare Turnstile bypass support.

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Start Turnstile Solver (Optional but Recommended)

```bash
docker compose up -d
```

Wait for the solver to finish installing (~2-3 minutes on first run):

```bash
docker logs -f turnstile-solver
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` to enable Turnstile solver:

```env
USE_TURNSTILE_SOLVER=true
SOLVER_URL=http://localhost:8080
HEADLESS=false
```

## Usage

### Phase 2: Basic Translation (JP→VI)

```bash
bun start
```

### Phase 3: Advanced (All Settings via Env)

```bash
TEXT="こんにちは" SOURCE_LANG=ja TARGET_LANG=vi USE_TURNSTILE_SOLVER=true bun start:advanced
```

### With Formality

```bash
TEXT="ありがとうございます" SOURCE_LANG=ja TARGET_LANG=vi FORMALITY=more USE_TURNSTILE_SOLVER=true bun start:advanced
```

## Cloudflare Bypass Strategies

This PoC supports **3 bypass approaches** (tried in order):

1. **Turnstile Solver** (Option B - Current Implementation)
   - Uses `theyka/turnstile_solver` Docker container
   - Solves Turnstile challenges in 4-6 seconds
   - Enable with: `USE_TURNSTILE_SOLVER=true`
   - Requires: `docker compose up -d`

2. **Stealth + Human Behavior** (Fallback)
   - `playwright-extra + puppeteer-extra-plugin-stealth`
   - Random user agents, mouse movements, scrolling, delays
   - Automatically used if solver fails or disabled

3. **Headed Mode Debug**
   - Run with `HEADLESS=false` to see browser actions
   - Useful for diagnosing Turnstile challenges

## Troubleshooting

### Turnstile Solver Not Responding

```bash
# Check solver container status
docker ps | grep turnstile

# View logs
docker logs turnstile-solver --tail=50

# Restart solver
docker compose restart

# Check health (once solver is ready)
curl http://localhost:8080/health
```

### Cloudflare Still Blocking

1. Ensure solver container is fully started (check logs)
2. Try with `HEADLESS=false` to debug visually
3. Check debug screenshots: `debug-*.png`

### Port 8080 Conflict

Edit `docker-compose.yml` to use different port:

```yaml
ports:
  - '8888:5000' # Change 8080 to 8888
```

Then update `.env`:

```env
SOLVER_URL=http://localhost:8888
```

## Architecture

```
┌─────────────────────────────────────────┐
│  Bun/Node.js (translator.ts)           │
│  ┌─────────────────────────────────┐   │
│  │ playwright-extra + stealth      │   │
│  │ + human-like behavior           │   │
│  └─────────────────────────────────┘   │
│              ▼ (if enabled)            │
│  ┌─────────────────────────────────┐   │
│  │ TurnstileSolver (API client)    │   │
│  └─────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │ HTTP POST /solve
               ▼
┌─────────────────────────────────────────┐
│  theyka/turnstile_solver (Docker)      │
│  ┌─────────────────────────────────┐   │
│  │ Python + Playwright + patchright│   │
│  │ Automated Turnstile solver      │   │
│  └─────────────────────────────────┘   │
│  Port 8080 → 5000 (internal)           │
└─────────────────────────────────────────┘
```

## Tech Stack

- **Bun** v1.1+ (JavaScript runtime)
- **TypeScript** 5.4+ (strict mode)
- **Playwright** ^1.52 (browser automation)
- **playwright-extra** + **stealth plugin** (anti-detection)
- **Docker** (Turnstile solver container)
- **theyka/turnstile_solver** (Python-based solver)

## Development

### Type Check

```bash
bun run typecheck
```

### Run Tests

```bash
bun test
```

## License

Internal research project.
