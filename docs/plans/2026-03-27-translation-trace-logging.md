# Translation Trace Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add trace-aware request and domain logging so operators can see exactly why a Chatwork message stops before AI translation or delivery.

**Architecture:** Keep `logixlysia` for access logs, but use structured domain events for workflow reasoning. Generate a `traceId` in `webhook-logger`, propagate it through `/internal/translate`, enrich translator observability logs with the same ID, and distinguish `room missing` from `room disabled` at the internal room-secret boundary.

**Tech Stack:** Bun, TypeScript, Elysia, logixlysia, Bun test

---

### Task 1: Lock the new logging contract with failing tests

**Files:**

- Modify: `packages/webhook-logger/src/routes/webhook.test.ts`
- Modify: `packages/translator/src/routes/internal-room-secret.test.ts`
- Modify: `packages/translator/src/webhook/router.test.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`

**Step 1: Write the failing webhook trace test**

Add a test in `packages/webhook-logger/src/routes/webhook.test.ts` that:

- sends a valid webhook payload
- captures structured `console.log` output
- asserts the emitted webhook logs include:

```ts
expect(parsedLog.traceId).toEqual(expect.any(String))
expect(parsedLog.event).toBe('room_secret_lookup_started')
```

and verifies the translator forward request carries:

```ts
expect(call[1]?.headers).toMatchObject({
  'Content-Type': 'application/json',
  'x-trace-id': expect.any(String),
})
```

**Step 2: Write the failing disabled-room room-secret test**

In `packages/translator/src/routes/internal-room-secret.test.ts`, add a test for a disabled room that asserts:

- response is still `404`
- a structured log event is emitted with:

```ts
expect(parsed.event).toBe('room_secret_lookup_room_disabled')
expect(parsed.nextExpectedAction).toBe('enable_room')
```

Add a separate test for an unknown room asserting:

```ts
expect(parsed.event).toBe('room_secret_lookup_not_found')
```

**Step 3: Write the failing translator ingress trace test**

In `packages/translator/src/webhook/router.test.ts`, add a test that sends:

```ts
headers: {
  'Content-Type': 'application/json',
  'x-trace-id': 'trace-123',
}
```

and asserts the handler receives the command together with the same trace context, either directly as an argument shape or through the newly introduced request context wrapper.

**Step 4: Write the failing provider-selection log test**

In `packages/translator/src/webhook/handler.test.ts`, add a test that runs a valid enabled-room command and asserts logs include:

```ts
expect(parsed.event).toBe('translation_provider_selected')
expect(parsed.traceId).toBe('trace-123')
expect(parsed.aiProvider).toBe('openai')
expect(parsed.resolvedModel).toBe('gpt-4o')
```

Also add a disabled-room test asserting:

```ts
expect(parsed.event).toBe('translation_skipped_room_disabled')
expect(parsed.nextExpectedAction).toBe('enable_room')
```

**Step 5: Run targeted tests to verify RED**

Run:

```bash
bun test \
  packages/webhook-logger/src/routes/webhook.test.ts \
  packages/translator/src/routes/internal-room-secret.test.ts \
  packages/translator/src/webhook/router.test.ts \
  packages/translator/src/webhook/handler.test.ts
```

Expected: FAIL because trace propagation and the new logging events do not exist yet.

**Step 6: Commit the RED state**

```bash
git add \
  packages/webhook-logger/src/routes/webhook.test.ts \
  packages/translator/src/routes/internal-room-secret.test.ts \
  packages/translator/src/webhook/router.test.ts \
  packages/translator/src/webhook/handler.test.ts
git commit -m "test(repo): add trace logging regressions"
```

### Task 2: Add trace-aware webhook-logger logging

**Files:**

- Modify: `packages/webhook-logger/src/app.ts`
- Modify: `packages/webhook-logger/src/routes/webhook.ts`

**Step 1: Upgrade logixlysia access format**

In `packages/webhook-logger/src/app.ts`, change the logger config to include context:

```ts
customLogFormat: '🦊 {now} {level} {duration} {method} {pathname} {status} {message} {context}'
```

Keep existing `showStartupMessage: false` and `ip: false`.

**Step 2: Add a small webhook logging helper**

In `packages/webhook-logger/src/routes/webhook.ts`, introduce a local helper with a stable event shape:

```ts
function logWebhookEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  context: Record<string, unknown>,
) {
  const line = JSON.stringify({
    level,
    service: 'webhook-logger',
    event,
    timestamp: new Date().toISOString(),
    ...context,
  })

  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}
```

**Step 3: Generate and propagate `traceId`**

At the start of `handleWebhook`, create:

```ts
const traceId = crypto.randomUUID()
```

Use this same `traceId` in:

- room-secret lookup logs
- webhook receive logs
- translation forward logs

When calling translator, include:

```ts
headers: {
  'Content-Type': 'application/json',
  'x-trace-id': traceId,
}
```

**Step 4: Log room-secret lookup decisions**

Add explicit events around `fetchRoomSecret`:

- `room_secret_lookup_started`
- `room_secret_lookup_resolved`
- `room_secret_lookup_not_found_or_disabled`

For the `404` path, log:

```ts
{
  traceId,
  roomId,
  skipReason: 'room_missing_or_disabled',
  nextExpectedAction: 'check_room_status'
}
```

Keep the HTTP behavior unchanged.

**Step 5: Run targeted tests to verify GREEN**

Run:

```bash
bun test packages/webhook-logger/src/routes/webhook.test.ts
```

Expected: PASS for the new webhook trace assertions.

**Step 6: Commit**

```bash
git add packages/webhook-logger/src/app.ts packages/webhook-logger/src/routes/webhook.ts \
  packages/webhook-logger/src/routes/webhook.test.ts
git commit -m "feat(webhook-logger): add trace-aware webhook logging"
```

### Task 3: Distinguish missing room vs disabled room in translator room-secret logs

**Files:**

- Modify: `packages/translator/src/app.ts`
- Modify: `packages/translator/src/routes/internal-room-secret.ts`
- Modify: `packages/translator/src/routes/internal-room-secret.test.ts`

**Step 1: Upgrade translator logixlysia access format**

In `packages/translator/src/app.ts`, apply the same `{context}` access-log format used in webhook-logger.

**Step 2: Add a translator route logging helper**

In `packages/translator/src/routes/internal-room-secret.ts`, add a helper similar to:

```ts
function logRoomSecretEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  context: Record<string, unknown>,
) {
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    JSON.stringify({
      level,
      service: 'translator',
      event,
      timestamp: new Date().toISOString(),
      requestSource: 'webhook',
      ...context,
    }),
  )
}
```

**Step 3: Split the `404` cases**

Replace the current combined branch:

```ts
if (!room?.enabled) { ...404... }
```

with explicit branches:

```ts
if (room === null) {
  logRoomSecretEvent('warn', 'room_secret_lookup_not_found', { roomId, traceId })
  ...
}

if (!room.enabled) {
  logRoomSecretEvent('info', 'room_secret_lookup_room_disabled', {
    roomId,
    roomConfigId: room.id,
    enabled: room.enabled,
    traceId,
    skipReason: 'room_disabled',
    nextExpectedAction: 'enable_room',
  })
  ...
}
```

For success, log:

```ts
logRoomSecretEvent('info', 'room_secret_lookup_resolved', {
  roomId,
  roomConfigId: room.id,
  enabled: room.enabled,
  traceId,
})
```

Read `traceId` from `x-trace-id` if present.

**Step 4: Run targeted tests**

Run:

```bash
bun test packages/translator/src/routes/internal-room-secret.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/translator/src/app.ts packages/translator/src/routes/internal-room-secret.ts \
  packages/translator/src/routes/internal-room-secret.test.ts
git commit -m "feat(translator): log room secret resolution outcomes"
```

### Task 4: Propagate trace context through translator ingress and handler

**Files:**

- Modify: `packages/translator/src/webhook/router.ts`
- Modify: `packages/translator/src/webhook/router.test.ts`
- Modify: `packages/translator/src/webhook/handler.ts`
- Modify: `packages/translator/src/webhook/handler.test.ts`
- Modify: `packages/translator/src/types/observability.ts`

**Step 1: Extend request context types**

In `packages/translator/src/types/observability.ts`, add:

```ts
traceId: string
```

to the request-context types that should carry correlation metadata.

**Step 2: Accept and log translator ingress trace**

In `packages/translator/src/webhook/router.ts`, read:

```ts
const traceId = headers['x-trace-id'] ?? crypto.randomUUID()
```

log:

```ts
{
  level: 'info',
  service: 'translator',
  event: 'translation_ingress_received',
  traceId,
  sourceMessageId: body.command.sourceMessageId,
  sourceRoomId: body.command.sourceRoomId,
}
```

and pass `traceId` into the background handler.

**Step 3: Update the handler signature minimally**

Refactor `handleTranslateRequest` and `createHandleTranslateRequest` so the handler receives both:

```ts
{
  command,
  traceId,
}
```

instead of only the bare command.

Keep the external route contract unchanged.

**Step 4: Enrich handler decision logs**

In `packages/translator/src/webhook/handler.ts`:

- include `traceId` in all existing skip/completion/failure logs
- when room exists, log:

```ts
{
  event: 'translation_room_resolved',
  traceId,
  roomConfigId: roomConfig.id,
  destinationRoomId: roomConfig.destinationRoomId,
  enabled: roomConfig.enabled,
}
```

- before pipeline execution, log:

```ts
{
  event: 'translation_provider_selected',
  traceId,
  aiProvider: roomConfig.aiProvider,
  resolvedModel: modelId,
  translationStyle,
}
```

and:

```ts
{
  event: 'translation_pipeline_started',
  traceId,
  sourceMessageId: command.sourceMessageId,
}
```

- for the disabled-room path, include:

```ts
nextExpectedAction: 'enable_room'
```

**Step 5: Run targeted tests**

Run:

```bash
bun test \
  packages/translator/src/webhook/router.test.ts \
  packages/translator/src/webhook/handler.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add \
  packages/translator/src/webhook/router.ts \
  packages/translator/src/webhook/router.test.ts \
  packages/translator/src/webhook/handler.ts \
  packages/translator/src/webhook/handler.test.ts \
  packages/translator/src/types/observability.ts
git commit -m "feat(translator): propagate trace context through translation flow"
```

### Task 5: Verify repo health and manual operator experience

**Files:**

- Modify: none

**Step 1: Run targeted suite**

```bash
bun test \
  packages/webhook-logger/src/routes/webhook.test.ts \
  packages/translator/src/routes/internal-room-secret.test.ts \
  packages/translator/src/webhook/router.test.ts \
  packages/translator/src/webhook/handler.test.ts
```

Expected: PASS

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: exit code 0

**Step 3: Run lint**

```bash
bun run lint
```

Expected: exit code 0

**Step 4: Run full suite**

```bash
bun test
```

Expected: PASS

**Step 5: Manual smoke check**

Run the local dev stack, send a message from Chatwork, and confirm logs now answer all of:

- did webhook arrive?
- which `traceId` belongs to this message?
- did room-secret lookup fail because room is missing or disabled?
- if disabled, is `nextExpectedAction` shown?
- if enabled, which provider/model was selected?
- did pipeline start?
- did delivery start and finish?

### Task 6: Commit final plan implementation state

**Files:**

- Modify: all files touched above

**Step 1: Create the final implementation commit**

```bash
git add \
  packages/webhook-logger/src/app.ts \
  packages/webhook-logger/src/routes/webhook.ts \
  packages/webhook-logger/src/routes/webhook.test.ts \
  packages/translator/src/app.ts \
  packages/translator/src/routes/internal-room-secret.ts \
  packages/translator/src/routes/internal-room-secret.test.ts \
  packages/translator/src/webhook/router.ts \
  packages/translator/src/webhook/router.test.ts \
  packages/translator/src/webhook/handler.ts \
  packages/translator/src/webhook/handler.test.ts \
  packages/translator/src/types/observability.ts \
  docs/plans/2026-03-27-translation-trace-logging-design.md \
  docs/plans/2026-03-27-translation-trace-logging.md
git commit -m "feat(repo): add trace-aware translation logging"
```

Expected: commit succeeds after hooks.
