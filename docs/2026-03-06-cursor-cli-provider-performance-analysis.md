# Performance & Scalability Analysis: Cursor CLI Provider via Local Proxy

**Date**: 2026-03-06  
**Scope**: Adding `cursor` as AI provider via `cursor-api-proxy` (localhost:8765) in the Chatwork Translation Bot monorepo.

---

## 1. Performance Summary

| Dimension             | Gemini         | OpenAI         | Cursor (via proxy)              |
| --------------------- | -------------- | -------------- | ------------------------------- |
| **Network**           | Cloud (Google) | Cloud (OpenAI) | Localhost (127.0.0.1)           |
| **Latency (typical)** | 200–800 ms     | 300–1000 ms    | 500–3000 ms (variable)          |
| **Cold start**        | None           | None           | **High** — CLI subprocess spawn |
| **Concurrency**       | High (cloud)   | High (cloud)   | **Low** — single proxy process  |
| **Cost**              | Pay-per-token  | Pay-per-token  | **$0** (Cursor subscription)    |
| **Availability**      | 99.9%+         | 99.9%+         | **Depends on local process**    |

**Key insight**: Cursor CLI via local proxy trades **lower cost** for **higher latency variance** and **lower concurrency**. It is ideal for local/dev testing, not for production at scale.

---

## 2. Latency & Resource Cost Comparison

### 2.1 Request Latency

| Provider         | Min     | Typical    | Max         | Notes                                         |
| ---------------- | ------- | ---------- | ----------- | --------------------------------------------- |
| **Gemini**       | ~150 ms | 300–500 ms | ~2 s        | Cloud, stable                                 |
| **OpenAI**       | ~200 ms | 400–700 ms | ~3 s        | Cloud, stable                                 |
| **Cursor proxy** | ~300 ms | 1–2 s      | **10–30 s** | Subprocess spawn, thinking models add latency |

**Cursor-specific factors**:

- **Subprocess spawn**: `cursor-api-proxy` invokes `cursor agent` CLI per request (or batches). Each spawn adds 200–500 ms.
- **Thinking models** (e.g. `claude-sonnet-4-5-thinking`): Extended reasoning increases TTFT and total time.
- **Localhost**: No network RTT, but CPU-bound inference dominates.

### 2.2 Resource Cost

| Provider   | Cost per 1K tokens (approx) | Monthly (100 translations/day) |
| ---------- | --------------------------- | ------------------------------ |
| **Gemini** | $0.001–0.01                 | ~$3–30                         |
| **OpenAI** | $0.01–0.03                  | ~$30–90                        |
| **Cursor** | **$0**                      | **$0** (Cursor subscription)   |

### 2.3 Resource Utilization (Cursor Proxy)

- **CPU**: Single Node process + Cursor CLI subprocess. High per-request CPU during inference.
- **Memory**: Proxy process ~50–100 MB; Cursor CLI adds ~200–500 MB per active session.
- **No connection pooling**: Each request goes through `http://127.0.0.1:8765` — no HTTP keep-alive benefit if proxy spawns subprocess per request.

---

## 3. Bottlenecks in Current Flow

### 3.1 Translation Flow (All Providers)

```
POST /internal/translate
  → 200 OK immediately (fire-and-forget)
  → handleTranslateRequest()
    → parseCommand / stripChatworkMarkup
    → TranslationServiceFactory.create(provider, model)
    → service.translate(cleanText)   ← NO TIMEOUT
    → writeTranslationOutput()
    → sendTranslatedMessage()
```

### 3.2 Identified Bottlenecks

| #   | Bottleneck                              | Impact                                                 | Severity             |
| --- | --------------------------------------- | ------------------------------------------------------ | -------------------- |
| 1   | **No timeout on `translate()`**         | Request can hang indefinitely; handler never completes | **Critical**         |
| 2   | **No retry on transient failures**      | Single network blip = permanent failure                | High                 |
| 3   | **No fallback provider**                | If primary fails, user gets no response                | High                 |
| 4   | **No circuit breaker**                  | Repeated failures keep hammering failing provider      | Medium               |
| 5   | **Cursor: single proxy process**        | Concurrent webhooks queue; no parallelism              | Medium (Cursor only) |
| 6   | **Cursor: proxy not running**           | `ECONNREFUSED` with no graceful degradation            | Medium (Cursor only) |
| 7   | **ChatworkClient fetch has no timeout** | `sendTranslatedMessage` can hang                       | Medium               |
| 8   | **TranslationError swallowed**          | Handler returns early; no retry or fallback            | Low (by design)      |

### 3.3 Cursor-Specific Bottlenecks

- **Proxy availability**: If `cursor-api-proxy` is not running, `fetch` to `127.0.0.1:8765` fails with `ECONNREFUSED`.
- **Sequential processing**: Proxy typically handles one request at a time; concurrent webhooks from Chatwork will queue.
- **Cold start**: First request after proxy start may be 2–5× slower.

---

## 4. Production-Ready Patterns — Pragmatic Recommendations

### 4.1 Priority Matrix

| Pattern                  | Effort | Impact   | Recommendation                            |
| ------------------------ | ------ | -------- | ----------------------------------------- |
| **Timeout**              | Low    | Critical | **Implement first**                       |
| **Retry (with backoff)** | Low    | High     | **Implement**                             |
| **Fallback provider**    | Medium | High     | **Implement** (env-driven)                |
| **Circuit breaker**      | Medium | Medium   | **Defer** — overkill for single-user bot  |
| **Connection pool**      | N/A    | N/A      | Not applicable (Bun fetch, no pool)       |
| **Health check**         | Low    | Medium   | **Implement** for Cursor (proxy liveness) |

### 4.2 Timeout (Must-Have)

**Where**: Wrap `service.translate()` and `sendTranslatedMessage()` with `AbortSignal.timeout()` or AI SDK `timeout` option.

**Implementation** (minimal):

```typescript
// In handler or a wrapper
const TRANSLATE_TIMEOUT_MS = 30_000; // 30s for thinking models

const result = await generateText({
  model: ...,
  prompt: ...,
  timeout: TRANSLATE_TIMEOUT_MS, // AI SDK supports this
});
```

**Recommendation**: Add `AI_TRANSLATE_TIMEOUT_MS` env (default 30s). Cursor thinking models may need 45–60s; cloud providers typically <10s.

### 4.3 Retry with Exponential Backoff (Should-Have)

**Where**: Around `service.translate()` for transient errors (5xx, network timeout, `ECONNRESET`).

**Implementation** (pragmatic):

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseMs?: number } = {},
): Promise<T> {
  const { maxAttempts = 3, baseMs = 1000 } = options
  let lastError: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (i < maxAttempts - 1 && isRetryable(e)) {
        await Bun.sleep(baseMs * Math.pow(2, i))
      } else throw e
    }
  }
  throw lastError
}

function isRetryable(e: unknown): boolean {
  if (e instanceof TranslationError && e.code === 'QUOTA_EXCEEDED') return false
  // Retry on: timeout, 5xx, ECONNREFUSED, ECONNRESET
  const msg = String(e instanceof Error ? e.message : e)
  return /timeout|ECONNREFUSED|ECONNRESET|5\d{2}/i.test(msg)
}
```

**Recommendation**: 3 attempts, 1s/2s/4s backoff. Skip retry for `QUOTA_EXCEEDED` and `INVALID_RESPONSE`.

### 4.4 Fallback Provider (Should-Have)

**Where**: When primary provider fails after retries, try a fallback if configured.

**Implementation** (env-driven):

```bash
# .env
AI_PROVIDER=cursor
AI_FALLBACK_PROVIDER=gemini   # optional
AI_FALLBACK_MODEL=gemini-2.0-flash
```

```typescript
// In handler
let result: TranslationResult
try {
  const primary = TranslationServiceFactory.create(env.AI_PROVIDER, env.AI_MODEL)
  result = await withRetry(() => primary.translate(cleanText))
} catch (e) {
  if (env.AI_FALLBACK_PROVIDER) {
    const fallback = TranslationServiceFactory.create(
      env.AI_FALLBACK_PROVIDER,
      env.AI_FALLBACK_MODEL,
    )
    result = await fallback.translate(cleanText)
  } else throw e
}
```

**Recommendation**: Optional. Most useful when `AI_PROVIDER=cursor` and proxy may be down; fallback to Gemini/OpenAI.

### 4.5 Circuit Breaker (Defer)

**Rationale**: This bot handles low-volume webhooks (single team, Chatwork). Circuit breaker adds complexity (state, half-open logic) with limited benefit. Recommend **deferring** until traffic grows or multiple services depend on the same provider.

If needed later: use a simple in-memory breaker (e.g. open after 5 consecutive failures, half-open after 30s).

### 4.6 Health Check for Cursor Proxy (Nice-to-Have)

**Where**: Optional startup or periodic check when `AI_PROVIDER=cursor`.

```typescript
async function checkCursorProxyAlive(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/v1$/, '')}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
}
```

**Recommendation**: Log warning at startup if proxy unreachable. Avoid failing startup — allow dev to start translator before proxy.

---

## 5. Scalability Assessment

### 5.1 Data Volume Projections

| Scenario                  | Webhooks/min | Cursor                   | Gemini/OpenAI |
| ------------------------- | ------------ | ------------------------ | ------------- |
| **Current (dev)**         | 1–5          | OK                       | OK            |
| **Small team (10 users)** | 5–20         | **Risk** — queue buildup | OK            |
| **Medium (50 users)**     | 20–100       | **Not viable**           | OK            |

**Conclusion**: Cursor via local proxy is suitable for **local/dev and very low volume** only. For production with multiple users, use Gemini or OpenAI.

### 5.2 Docker / Production Deployment

- **cursor-api-proxy** must run as a separate process. In Docker Compose, add a `cursor-proxy` service.
- Translator and proxy must share a network (e.g. `localhost` only works if same container; use service name for multi-container).
- **Recommendation**: For production, use `AI_PROVIDER=gemini` or `openai`; reserve `cursor` for local development.

---

## 6. Recommended Actions (Prioritized)

1. **Add timeout** to `generateText` (and optionally Chatwork `fetch`) — `AI_TRANSLATE_TIMEOUT_MS` env, default 30s.
2. **Add retry with backoff** around `translate()` for retryable errors.
3. **Add optional fallback provider** when `AI_PROVIDER=cursor` and `AI_FALLBACK_PROVIDER` is set.
4. **Document** Cursor proxy as dev-only in README; recommend Gemini/OpenAI for production.
5. **Defer** circuit breaker and connection pooling unless traffic grows.

---

## 7. Summary

| Aspect                       | Verdict                                                                  |
| ---------------------------- | ------------------------------------------------------------------------ |
| **Cursor CLI via proxy**     | Good for local/dev, zero cost; higher latency variance, low concurrency  |
| **Latency vs Gemini/OpenAI** | Cursor often slower (1–3s vs 0.3–1s) due to subprocess + thinking models |
| **Critical gap**             | No timeout — implement first                                             |
| **Pragmatic additions**      | Timeout → Retry → Fallback; skip circuit breaker for now                 |
| **Production**               | Use Gemini/OpenAI; Cursor for local testing only                         |
