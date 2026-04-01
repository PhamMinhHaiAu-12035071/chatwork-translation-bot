# Translation Context & Keyword Protection Logging Design

**Date:** 2026-04-01  
**Prepared by:** AI-assisted (based on user interview)  
**Status:** Pending User Review (Bước 6)

---

## 1. Executive Summary

**Goal:** Add comprehensive structured logging for **Translation Context** and **Keyword Protection** features to provide debugging capability, audit trail, and evidence that features work correctly in production.

**Current State:** Both features are fully implemented with working code, but have **ZERO logs**. This means:

- Cannot verify features working in production
- No audit trail for sensitive data handling
- Impossible to debug issues when they occur

**Solution:** Add **3 new log events** to `handler.ts` using existing `observer.logEvent()` pattern:

1. `translation_context_applied` — When room context exists and is injected
2. `translation_keywords_masked` — After masking, before AI
3. `translation_keywords_restored` — After AI, after restore

**Security:** All events log **metadata only** (counts, lengths, booleans) — **NEVER** raw content (keywords, context text, user messages).

---

## 2. Objectives

### Primary Goals

1. ✅ **Evidence of correctness** — Verify features work in production via structured logs
2. ✅ **Debugging capability** — Enable troubleshooting when issues occur
3. ✅ **Audit trail** — Provide chronological evidence of sensitive data handling
4. ✅ **Security** — Maintain zero exposure of sensitive data in logs

### Success Criteria

- All translation requests with context show `translation_context_applied` event
- All requests with protected keywords show `translation_keywords_masked` + `translation_keywords_restored` events
- Logs show flow: context → mask → [AI pipeline] → restore
- Zero sensitive data (keywords, context text, user messages) in logs
- Minimal code change (handler.ts only)

---

## 3. Scope

### In Scope

- Add 3 new log events to `packages/translator/src/webhook/handler.ts`
- Use existing `observer.logEvent()` pattern
- Log safe metadata: counts, lengths, booleans
- Update tests to verify new events

### Out of Scope

- Changing existing log events
- Adding logs to other files (keyword-redactor.ts, pipeline.ts, etc.)
- Logging raw content or sensitive data
- Performance monitoring (covered by existing phase logs)
- Dashboard UI for log visualization

---

## 4. Non-Goals

- Do NOT expose sensitive data in any form
- Do NOT change existing logging architecture
- Do NOT add logs that duplicate existing phase/delivery events

---

## 5. Definition of Done

- [ ] 3 new log events implemented in handler.ts
- [ ] All events follow existing naming convention (`translation_*`)
- [ ] All events use `observer.logEvent()` pattern
- [ ] Tests verify new events appear with correct data
- [ ] Zero sensitive data in logs (manual audit)
- [ ] Full typecheck + lint pass
- [ ] Design doc reviewed and approved by user

---

## 6. Constraints

1. **Security:** NEVER log: `roomConfig.context`, keyword strings, any masked/unmasked user text, `systemHint`, `restoreMap` keys/values, prompts, or segment contents
2. **File scope:** Changes only to `packages/translator/src/webhook/handler.ts`
3. **Pattern consistency:** Follow existing `observer.logEvent(level, eventName, extraFields)` pattern
4. **Naming:** Use `translation_*` prefix for all new events

---

## 7. Technical Approach

### 7.1 Event: `translation_context_applied`

**When:** After checking `roomConfig.context`, before `new TranslationPipeline()`  
**Level:** `info`  
**Location:** handler.ts, line ~237 (after setting `pipelineOpts.roomContext`)

**Metadata fields:**

```typescript
{
  roomContextApplied: boolean,     // true when roomConfig.context exists and trimmed length > 0
  roomContextLength: number,        // character count of context (same convention as inputLength)
}
```

**Emit condition:** Only when `roomConfig.context` is truthy (trimmed length > 0)

**Example log:**

```json
{
  "level": "info",
  "service": "translator",
  "event": "translation_context_applied",
  "timestamp": "2026-04-01T08:19:31.716Z",
  "traceId": "a83bfce5-15ce-46dc-a38c-ebe4440c4c4c",
  "requestId": "19557533-ea0d-42b1-be7d-c56ca2f4bfb9",
  "sourceMessageId": "2091103691116654592",
  "roomId": 424846369,
  "roomContextApplied": true,
  "roomContextLength": 87
}
```

---

### 7.2 Event: `translation_keywords_masked`

**When:** After `maskKeywords()` on cleanText and segments, before `new TranslationPipeline()`  
**Level:** `info`  
**Location:** handler.ts, line ~225 (after masking)

**Metadata fields:**

```typescript
{
  configuredKeywordCount: number,           // keywords.length (from room config)
  primaryTextChangedByMask: boolean,        // cleanText !== maskedText (after NFC normalization)
  translationInputSegmentCount: number,     // command.translationInputs.length
  segmentsChangedByMaskCount: number,       // count of segments where original !== masked
  hasSystemHint: boolean,                   // systemHint.length > 0
}
```

**Emit condition:** **Always** (even when `configuredKeywordCount === 0` or no text changed)  
**Rationale:** Provides audit trail that feature ran; helps distinguish "feature didn't run" (bug) vs "message has no keywords" (normal)

**Example log (keywords matched):**

```json
{
  "level": "info",
  "service": "translator",
  "event": "translation_keywords_masked",
  "timestamp": "2026-04-01T08:19:31.725Z",
  "traceId": "a83bfce5-15ce-46dc-a38c-ebe4440c4c4c",
  "requestId": "19557533-ea0d-42b1-be7d-c56ca2f4bfb9",
  "sourceMessageId": "2091103691116654592",
  "roomId": 424846369,
  "configuredKeywordCount": 3,
  "primaryTextChangedByMask": true,
  "translationInputSegmentCount": 1,
  "segmentsChangedByMaskCount": 1,
  "hasSystemHint": true
}
```

**Example log (no keywords matched):**

```json
{
  "level": "info",
  "service": "translator",
  "event": "translation_keywords_masked",
  "timestamp": "2026-04-01T08:19:31.725Z",
  "traceId": "...",
  "configuredKeywordCount": 3,
  "primaryTextChangedByMask": false,
  "translationInputSegmentCount": 1,
  "segmentsChangedByMaskCount": 0,
  "hasSystemHint": true
}
```

---

### 7.3 Event: `translation_keywords_restored`

**When:** **Immediately after** `restoreKeywords()` on translatedText and segments, **before** `writeTranslationOutput()` and delivery  
**Level:** `info`  
**Location:** handler.ts, line ~271 (after restore, before output write)

**Metadata fields:**

```typescript
{
  configuredKeywordCount: number,                   // same as mask (for audit consistency)
  primaryTranslationChangedByRestore: boolean,      // pipeline translatedText !== final restored text
  segmentsChangedByRestoreCount: number,            // count of segments where pre-restore !== post-restore
}
```

**Emit condition:** **Always** (even when no text changed)  
**Rationale:** Complete audit trail showing restore happened, even if pipeline failed to preserve placeholders or message had no keywords

**Example log:**

```json
{
  "level": "info",
  "service": "translator",
  "event": "translation_keywords_restored",
  "timestamp": "2026-04-01T08:19:38.680Z",
  "traceId": "a83bfce5-15ce-46dc-a38c-ebe4440c4c4c",
  "requestId": "19557533-ea0d-42b1-be7d-c56ca2f4bfb9",
  "sourceMessageId": "2091103691116654592",
  "roomId": 424846369,
  "configuredKeywordCount": 3,
  "primaryTranslationChangedByRestore": true,
  "segmentsChangedByRestoreCount": 1
}
```

---

## 8. Flow Diagram

```
[webhook-logger] → [translator ingress]
  ↓
[handler: roomConfig resolved]
  ↓
[handler: context check]
  ├─ IF roomConfig.context exists → LOG translation_context_applied
  ↓
[handler: maskKeywords]
  ├─ LOG translation_keywords_masked (always)
  ↓
[TranslationPipeline with masked text + systemHint]
  ↓
[handler: restoreKeywords]
  ├─ LOG translation_keywords_restored (always)
  ↓
[writeOutput → delivery → writeOutput with delivery]
```

**Chronological log order:**

1. `translation_room_resolved` (existing)
2. `translation_provider_selected` (existing)
3. `translation_pipeline_started` (existing)
4. ✨ **`translation_context_applied`** (new, optional)
5. ✨ **`translation_keywords_masked`** (new, always)
6. `translation_phase_started` [translation] (existing)
7. `translation_phase_completed` [translation] (existing)
8. ✨ **`translation_keywords_restored`** (new, always)
9. `translation_phase_started` [delivery] (existing)
10. `translation_delivery_started` (existing)
11. `translation_delivery_completed` (existing)
12. `translation_phase_completed` [delivery] (existing)
13. `translation_output_persisted` (existing)
14. `translation_request_completed` (existing)

---

## 9. Edge Cases

| Scenario                                         | Behavior                                                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| No keywords configured (`keywords.length === 0`) | Emit `translation_keywords_masked` with `configuredKeywordCount: 0`, `primaryTextChangedByMask: false`, `hasSystemHint: false`          |
| Keywords configured but none match               | Emit `translation_keywords_masked` with `configuredKeywordCount: N`, `primaryTextChangedByMask: false`, `segmentsChangedByMaskCount: 0` |
| No context (`roomConfig.context` is null)        | Do NOT emit `translation_context_applied`                                                                                               |
| Pipeline fails after mask but before restore     | Only `translation_keywords_masked` appears (no restore event) — correct behavior                                                        |
| AI fails to preserve placeholders                | `translation_keywords_restored` shows `segmentsChangedByRestoreCount: 0` — helps detect AI bug                                          |
| Restore happens but delivery fails               | Both mask + restore events exist — proves restore happened regardless of delivery                                                       |

---

## 10. Security Analysis

### What We Log (Safe)

- ✅ Counts: `configuredKeywordCount`, `segmentsChangedByMaskCount`, `roomContextLength`
- ✅ Booleans: `roomContextApplied`, `primaryTextChangedByMask`, `hasSystemHint`
- ✅ Existing safe fields: `traceId`, `requestId`, `sourceMessageId`, `roomId`

### What We NEVER Log (Unsafe)

- ❌ `roomConfig.context` content
- ❌ Keyword strings from `protectedKeywords` array
- ❌ Any user message text (original or masked or translated)
- ❌ `systemHint` content
- ❌ `restoreMap` keys or values
- ❌ AI prompts or responses

### Risk Assessment

- **Risk of sensitive data exposure:** ✅ **Zero** (no raw text logged)
- **Risk of inference attacks:** ✅ **Minimal** (counts alone don't reveal content)
- **Compliance:** ✅ Safe for audit logs (no PII/sensitive data)

---

## 11. Debugging Scenarios

### Scenario 1: Context not applied

**Symptom:** Translation quality poor despite context configured  
**Debug:** Check logs for `translation_context_applied` event

- ✅ If present → context was applied, issue is elsewhere
- ❌ If absent → context not applied (bug in handler or config)

### Scenario 2: Keywords leaked to AI

**Symptom:** Audit shows keywords in AI API logs  
**Debug:** Check our logs for mask/restore flow

- `translation_keywords_masked` should show `primaryTextChangedByMask: true`
- `translation_keywords_restored` should show `primaryTranslationChangedByRestore: true`
- If mask shows `false` → masking didn't work (keyword-redactor bug)

### Scenario 3: Placeholders in final output

**Symptom:** User reports seeing `[COMPANY_1]` in translation  
**Debug:** Check `translation_keywords_restored`

- If `primaryTranslationChangedByRestore: false` → restore didn't change anything (AI failed to preserve placeholder OR no keywords in original message)
- If `segmentsChangedByRestoreCount: 0` → restore ran but found no placeholders (AI bug or masking bug)

### Scenario 4: Mismatch between mask and restore

**Symptom:** Translation looks wrong  
**Debug:** Compare mask vs restore events

- `translation_keywords_masked`: `segmentsChangedByMaskCount: 2`
- `translation_keywords_restored`: `segmentsChangedByRestoreCount: 0`
- → AI lost the placeholders or restore logic failed

---

## 12. Metrics & Analytics

With these logs, we can derive:

**Context metrics:**

- % of requests with context applied
- Average context length
- Rooms actively using context feature

**Keyword protection metrics:**

- % of requests with keywords configured
- % of requests where masking changed text
- % of requests where restore changed text
- Average keywords per room
- SystemHint generation rate

**Quality metrics:**

- Mask/restore mismatch rate (detect AI or restore bugs)
- Placeholder preservation rate by AI model

---

## 13. Implementation Details

### 13.1 Code Changes

**File:** `packages/translator/src/webhook/handler.ts`

**Change 1:** After line ~237 (context check)

```typescript
if (roomConfig.context) {
  pipelineOpts.roomContext = roomConfig.context
  // NEW: Log context applied
  observer.logEvent('info', 'translation_context_applied', {
    roomContextApplied: true,
    roomContextLength: Array.from(roomConfig.context).length, // grapheme count
  })
}
```

**Change 2:** After line ~225 (masking)

```typescript
const keywords = roomConfig.protectedKeywords ?? []
const { maskedText, restoreMap, systemHint } = maskKeywords(cleanText, keywords)
const maskedTranslationInputs = command.translationInputs.map(
  (segment) => maskKeywords(segment, keywords).maskedText,
)

// NEW: Log masking result
const primaryTextChangedByMask = cleanText.normalize('NFC') !== maskedText
const segmentsChangedByMaskCount = command.translationInputs.filter(
  (seg, idx) => seg.normalize('NFC') !== maskedTranslationInputs[idx],
).length

observer.logEvent('info', 'translation_keywords_masked', {
  configuredKeywordCount: keywords.length,
  primaryTextChangedByMask,
  translationInputSegmentCount: command.translationInputs.length,
  segmentsChangedByMaskCount,
  hasSystemHint: systemHint.length > 0,
})
```

**Change 3:** After line ~271 (restore)

```typescript
// Restore original keywords in translated output
const result: TranslationResult = {
  ...pipelineResult.translation,
  cleanText, // restore unmasked original
  translatedText: restoreKeywords(pipelineResult.translation.translatedText, restoreMap),
}
const restoredTranslatedSegments = pipelineResult.translatedSegments.map((seg) =>
  restoreKeywords(seg, restoreMap),
)

// NEW: Log restoration result
const primaryTranslationChangedByRestore =
  pipelineResult.translation.translatedText !== result.translatedText
const segmentsChangedByRestoreCount = pipelineResult.translatedSegments.filter(
  (seg, idx) => seg !== restoredTranslatedSegments[idx],
).length

observer.logEvent('info', 'translation_keywords_restored', {
  configuredKeywordCount: keywords.length,
  primaryTranslationChangedByRestore,
  segmentsChangedByRestoreCount,
})
```

---

### 13.2 Type Changes (if needed)

If `observer.logEvent` rejects unknown keys, minimal type widen in `packages/translator/src/types/observability.ts`:

```typescript
export interface TranslatorLogEntry {
  // ... existing fields ...

  // Context logging
  roomContextApplied?: boolean
  roomContextLength?: number

  // Keyword masking
  configuredKeywordCount?: number
  primaryTextChangedByMask?: boolean
  translationInputSegmentCount?: number
  segmentsChangedByMaskCount?: number
  hasSystemHint?: boolean

  // Keyword restoration
  primaryTranslationChangedByRestore?: boolean
  segmentsChangedByRestoreCount?: number
}
```

**Note:** If handler-only constraint is strict, use explicit cast on extra fields and accept slightly weaker typing until follow-up PR.

---

## 14. Testing Strategy

### 14.1 Unit Tests

Add test cases to `packages/translator/src/webhook/handler.test.ts`:

**Test 1:** Context applied when room has context

```typescript
it('logs translation_context_applied when room has context', async () => {
  const mockObserver = createMockObserver()
  // ... setup with roomConfig.context = "Room type: Client"

  await handleTranslateRequest(command)

  const contextEvent = mockObserver.getEventByName('translation_context_applied')
  expect(contextEvent).toBeDefined()
  expect(contextEvent.roomContextApplied).toBe(true)
  expect(contextEvent.roomContextLength).toBeGreaterThan(0)
})
```

**Test 2:** Keywords masked and restored

```typescript
it('logs translation_keywords_masked and _restored with correct counts', async () => {
  const mockObserver = createMockObserver()
  // ... setup with roomConfig.protectedKeywords = [{ keyword: "Asia Vion", category: "company" }]

  await handleTranslateRequest(command)

  const maskEvent = mockObserver.getEventByName('translation_keywords_masked')
  expect(maskEvent.configuredKeywordCount).toBe(1)
  expect(maskEvent.primaryTextChangedByMask).toBe(true)

  const restoreEvent = mockObserver.getEventByName('translation_keywords_restored')
  expect(restoreEvent.configuredKeywordCount).toBe(1)
  expect(restoreEvent.primaryTranslationChangedByRestore).toBe(true)
})
```

**Test 3:** Logs emitted even when no keywords match

```typescript
it('logs keywords_masked event even when no keywords match', async () => {
  const mockObserver = createMockObserver()
  // ... setup with keywords but message doesn't contain them

  await handleTranslateRequest(command)

  const maskEvent = mockObserver.getEventByName('translation_keywords_masked')
  expect(maskEvent.configuredKeywordCount).toBeGreaterThan(0)
  expect(maskEvent.primaryTextChangedByMask).toBe(false)
  expect(maskEvent.segmentsChangedByMaskCount).toBe(0)
})
```

**Test 4:** No context event when context is null

```typescript
it('does not log translation_context_applied when context is null', async () => {
  const mockObserver = createMockObserver()
  // ... setup with roomConfig.context = null

  await handleTranslateRequest(command)

  const contextEvent = mockObserver.getEventByName('translation_context_applied')
  expect(contextEvent).toBeUndefined()
})
```

---

### 14.2 Integration Tests

**Test 5:** Full flow with context + keywords

```typescript
it('logs all 3 new events in correct order for full-featured room', async () => {
  // ... setup with both context and keywords

  await handleTranslateRequest(command)

  const events = mockObserver.getAllEvents()
  const contextIdx = events.findIndex((e) => e.event === 'translation_context_applied')
  const maskIdx = events.findIndex((e) => e.event === 'translation_keywords_masked')
  const restoreIdx = events.findIndex((e) => e.event === 'translation_keywords_restored')

  // Verify order: context → mask → [pipeline] → restore
  expect(contextIdx).toBeLessThan(maskIdx)
  expect(maskIdx).toBeLessThan(restoreIdx)
})
```

---

## 15. Acceptance Criteria

- [ ] **AC-1:** When room has `context`, `translation_context_applied` event appears with `roomContextApplied: true` and `roomContextLength > 0`
- [ ] **AC-2:** When room has `protectedKeywords`, `translation_keywords_masked` event appears with correct `configuredKeywordCount`
- [ ] **AC-3:** After AI translation, `translation_keywords_restored` event appears with restore statistics
- [ ] **AC-4:** All 3 events use `observer.logEvent()` pattern and inherit `traceId`, `requestId`, `sourceMessageId`
- [ ] **AC-5:** Events appear in chronological order: context → mask → [pipeline] → restore
- [ ] **AC-6:** No sensitive data (keywords, context text, user messages) in any log
- [ ] **AC-7:** All tests pass (`bun test`)
- [ ] **AC-8:** Typecheck passes (`bun run typecheck`)
- [ ] **AC-9:** Lint passes (`bun run lint`)
- [ ] **AC-10:** Manual docker logs test shows all events for test message with context + keywords

---

## 16. Open Risks

| Risk                                                     | Likelihood | Impact   | Mitigation                                                             |
| -------------------------------------------------------- | ---------- | -------- | ---------------------------------------------------------------------- |
| Type errors if `TranslatorLogEntry` rejects unknown keys | Low        | Medium   | Add optional fields to type or use explicit cast in handler            |
| Log volume increase in high-traffic rooms                | Low        | Low      | Events are small (~150 bytes each); 3 events per request is acceptable |
| Performance impact of string comparison checks           | Very Low   | Very Low | Simple equality checks on already-computed strings; negligible         |

---

## 17. Out-of-Scope / Future Enhancements

### Not in this design:

- Dashboard UI for log visualization
- Alerting on suspicious patterns (e.g., high mismatch rate)
- Metrics aggregation or analytics pipeline
- Logging in `keyword-redactor.ts` itself (keep it pure)
- Logging in `translation-prompt.ts` (no observer access there)
- Performance profiling of mask/restore operations

### Potential future work:

- Add `keywordCategoryCounts` for ops tuning (e.g., `{company: 2, person: 1}`)
- Add `roomContextNearLimit` warning when context length > 450 chars
- Add context/keyword presence to existing phase events (reduce total event count)

---

## 18. Explicit Decisions Made (from User Interview)

| Decision                     | Choice                       | Rationale                                                                              |
| ---------------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| Emit when no keywords match? | ✅ Always emit               | Audit trail > log volume; distinguish "feature didn't run" vs "no keywords in message" |
| Detail level?                | Standard (counts + booleans) | Balance debugging capability with security                                             |
| Context logging?             | Presence + length            | Useful metrics without exposing content                                                |
| Restore log timing?          | Immediately after restore    | Complete audit trail even if delivery fails                                            |

---

## 19. Review Checklist (for User - Bước 6)

Please review and confirm:

- [ ] Security: No sensitive data logged (keywords, context text, user messages)
- [ ] Naming: `translation_context_applied`, `translation_keywords_masked`, `translation_keywords_restored` are clear
- [ ] Metadata fields: All fields are useful for debugging
- [ ] Edge cases: Behavior is correct for all scenarios (no keywords, no context, pipeline failure, etc.)
- [ ] Flow: Chronological order makes sense (context → mask → [AI] → restore)
- [ ] Implementation approach: Handler-only changes, minimal code, follows existing patterns

---

## 20. Next Steps

After user approval of this design:

1. ✅ Invoke `writing-plans` skill to create implementation plan
2. Create feature branch: `feat/translation-context-keyword-logging`
3. Implement 3 log events in handler.ts
4. Add test cases to handler.test.ts
5. Update types if needed (observability.ts)
6. Run full test suite (`bun test && bun run typecheck && bun run lint`)
7. Manual docker logs test with sample messages
8. Commit with message: `feat(translator): add logging for context & keyword protection`
9. Create PR for review

---

**End of Design Document**
