# Translation Trace Logging Design

**Date:** 2026-03-27

## Goal

Improve translator and webhook-logger observability so a single Chatwork message can be traced end-to-end and operators can immediately see why processing stopped before AI translation or delivery.

## Problem Summary

The current system already logs request-level access via `logixlysia` and emits several structured JSON events in business logic, but the logs are still insufficient for debugging real-world failures quickly.

In particular:

- request logs and domain logs are not correlated with a shared trace identifier
- `room missing` and `room disabled` are effectively collapsed into the same operational symptom at the webhook boundary
- the system does not clearly log the handoff between:
  - webhook receive
  - room-secret resolution
  - translator ingress
  - room-config resolution
  - provider selection
  - pipeline start
  - delivery start/completion/failure

As a result, an operator can see that a webhook arrived, but still cannot answer the practical question:

> Why did this message not reach the AI provider and destination room?

## Current Behavior

### Request-level logging

- `logixlysia` logs HTTP method, path, status, and duration in both `translator` and `webhook-logger`
- this is useful for access-level visibility but not enough for workflow reasoning

### Domain-level logging

- `webhook-logger` logs events such as:
  - `webhook_received`
  - `translation_forward_started`
  - `translation_forward_completed`
  - `webhook_skipped_no_room_config`
- `translator` logs events such as:
  - `translation_skipped_no_room_config`
  - `translation_skipped_room_disabled`
  - delivery/pipeline observability events

### Main observability gap

The system has domain logs, but they do not form a coherent trace. A real message currently lacks a single correlation key across services, and several decision points are under-instrumented.

## Root Cause of the Logging Gap

The issue is not one missing log line. It is architectural:

- access logging and workflow logging are separate and not correlated
- there is no explicit trace propagation from `/webhook` to `/internal/translate`
- the internal room-secret lookup logs status indirectly through HTTP outcomes rather than explicit domain reasons
- skip reasons are not always logged with actionable next steps

## Scope

In scope:

- enrich `logixlysia` configuration so request logs surface structured context more clearly
- add a generated `traceId` at webhook ingress and propagate it into translator flow
- expand structured domain logs around room-secret lookup, room-config resolution, provider selection, pipeline start, and delivery lifecycle
- distinguish `room missing` from `room disabled`
- add tests that lock the new logging behavior

Out of scope:

- changing translation behavior or provider behavior
- changing the existing HTTP contract of `/internal/room-secret`
- introducing a full external tracing stack
- logging secrets, raw API tokens, or full payload bodies by default

## Approaches Considered

### 1. Hybrid request-trace + domain events

Keep `logixlysia` for request/access logs and enrich business-flow logs with explicit trace propagation and decision-point events.

Pros:

- solves the real debugging problem
- preserves existing architecture
- minimal blast radius
- gives both transport-level and business-level visibility

Cons:

- requires touching multiple files across two services

### 2. Logixlysia-only richer access logs

Use only `customLogFormat` and route logger helpers without adding trace-aware domain logging.

Pros:

- small implementation

Cons:

- does not explain why the workflow stopped
- still weak for multi-hop debugging

### 3. Full debug-mode verbose logging

Introduce a dedicated debug mode that logs everything at every step.

Pros:

- maximum visibility

Cons:

- high noise
- higher risk of leaking too much payload context
- overkill for the current need

## Approved Design

Use Approach 1.

### 1. Keep `logixlysia` for access logging

`logixlysia` remains the standard request logger in:

- `packages/webhook-logger/src/app.ts`
- `packages/translator/src/app.ts`

It should be configured to always include `{context}` in the rendered log format so route-level logger calls can surface structured metadata on the same line as the HTTP log.

This does **not** replace business-flow logs.

### 2. Introduce an explicit end-to-end `traceId`

At webhook ingress in `webhook-logger`:

- generate a `traceId`
- attach it to all subsequent domain logs
- forward it to `translator` via `x-trace-id`

At translator ingress:

- read `x-trace-id`
- log it immediately on `/internal/translate`
- propagate it into background handler logs and translator observability events

The purpose is not distributed tracing infrastructure; it is practical correlation across two services and multiple async steps.

### 3. Add decision-point logs where operators need answers

#### Webhook Logger

Add or refine logs for:

- `webhook_received`
- `room_secret_lookup_started`
- `room_secret_lookup_resolved`
- `room_secret_lookup_not_found_or_disabled`
- `webhook_signature_verified`
- `translation_forward_started`
- `translation_forward_completed`
- `translation_forward_failed`

When the room-secret lookup returns `404`, the log must include actionable context such as:

- `roomId`
- `traceId`
- `skipReason`
- `nextExpectedAction`

The goal is that a single log line already hints at the likely operator action, for example `enable_room`.

#### Translator internal room-secret route

Keep the existing `404` response contract, but log explicit reasons before returning:

- `room_secret_lookup_not_found`
- `room_secret_lookup_room_disabled`
- `room_secret_lookup_resolved`

This closes the current ambiguity where a `404` can mean either missing config or disabled room.

#### Translator ingress and pipeline

At `/internal/translate` and in the background handler, add logs for:

- `translation_ingress_received`
- `translation_room_resolved`
- `translation_skipped_no_room_config`
- `translation_skipped_room_disabled`
- `translation_provider_selected`
- `translation_pipeline_started`
- `translation_delivery_started`
- existing completion/failure events enriched with `traceId`

These logs should let an operator see whether the system:

- never reached translator ingress
- reached translator but skipped before AI
- selected a provider and started the pipeline
- failed later in delivery

### 4. Use structured correlation fields consistently

The following fields should be used wherever relevant:

- `traceId`
- `sourceMessageId`
- `sourceRoomId`
- `roomConfigId`
- `destinationRoomId`
- `enabled`
- `aiProvider`
- `resolvedModel`
- `translationStyle`
- `skipReason`
- `nextExpectedAction`

The exact field set can vary by event, but these names should stay stable and consistent.

### 5. Keep secrets out of logs

Never log:

- `aiApiToken`
- `webhookSecret`
- encrypted token/secret values
- full decrypted secret material

Avoid logging full payload bodies or translated output by default.

If more context is needed, prefer summary fields such as:

- `bodyLength`
- `translationInputCount`
- `sourceEventType`

## Testing Strategy

### Webhook Logger route tests

Update `packages/webhook-logger/src/routes/webhook.test.ts` to verify:

- `traceId` is generated and appears in structured logs
- room-secret lookup logs include the correct skip reason when translator returns `404`
- `x-trace-id` is forwarded to `/internal/translate`

### Translator internal-room-secret route tests

Update `packages/translator/src/routes/internal-room-secret.test.ts` to verify:

- disabled room and missing room produce distinct log events
- successful resolution logs the correct event and room metadata

### Translator router and handler tests

Update:

- `packages/translator/src/webhook/router.test.ts`
- `packages/translator/src/webhook/handler.test.ts`

to verify:

- trace propagation from ingress into handler
- room-disabled logs include `nextExpectedAction: enable_room`
- provider/model selection is logged before the pipeline begins

### Repo verification

- targeted tests for changed logging surfaces
- `bun run typecheck`
- `bun run lint`
- `bun test`

## Success Criteria

- a single message can be correlated across webhook-logger and translator with one `traceId`
- logs clearly distinguish:
  - room missing
  - room disabled
  - provider/pipeline start
  - delivery failure
- operators can tell why processing stopped without reading source code
- no secrets are added to logs
