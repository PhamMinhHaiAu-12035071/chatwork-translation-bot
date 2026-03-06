# cursor-api-proxy Risk Assessment

`cursor-api-proxy` is a **community package** ([anyrobert/cursor-api-proxy](https://github.com/anyrobert/cursor-api-proxy)).
It is pinned at a specific Git commit and used for **LOCAL DEVELOPMENT ONLY**.

## Constraints

- Must **never** be installed or run in production
- `CURSOR_API_URL` is enforced to `localhost` / `127.0.0.1` by Zod schema
- Startup guards verify proxy reachability before server starts

## Version Policy

- Pinned via `github:anyrobert/cursor-api-proxy` in root `package.json` devDependencies
- Lockfile (`bun.lock`) pins the exact Git commit hash
- Re-evaluate the pin on every major upstream update
- Before updating: review changelog, check for breaking API changes, verify `/v1/models` and `/v1/chat/completions` endpoints still conform to OpenAI-compatible shape

## What It Does

Runs a local HTTP server (default `127.0.0.1:8765`) that proxies requests to the Cursor CLI (`agent`).
Exposes OpenAI-compatible endpoints so the AI SDK (`@ai-sdk/openai-compatible`) can call Cursor models.

## Failure Modes

| Scenario                       | Impact                                | Mitigation                                       |
| ------------------------------ | ------------------------------------- | ------------------------------------------------ |
| Package disappears from GitHub | Cannot reinstall                      | Lockfile caches the tarball; fork if needed      |
| Breaking API change            | Translation calls fail                | Pinned commit prevents auto-update               |
| Proxy process crashes          | Startup guard catches on next restart | Manual restart required                          |
| Cursor CLI not installed       | Proxy can't spawn agent               | Error message from proxy; `agent login` required |
