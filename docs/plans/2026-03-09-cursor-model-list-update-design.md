# Design: Update Cursor Model List with Fast/Slow/Max Classification

**Date**: 2026-03-09
**Status**: Approved
**Scope**: `packages/provider-cursor/src/cursor-plugin.ts`, related tests

## Problem

The current `CURSOR_MODEL_VALUES` contains invalid model names that do not exist in the cursor-api-proxy runtime:

- `gpt-5-mini` — causes `Cannot use this model` error (confirmed in proxy log)
- `cursor-small` — not present in available models list
- All Anthropic models use old naming convention (`claude-sonnet-4-5`) instead of cursor-api-proxy convention (`sonnet-4.5`)
- `DEFAULT_CURSOR_MODEL = 'claude-sonnet-4-5'` — invalid, will cause runtime error

**Root cause**: cursor-api-proxy uses its own model ID aliases, different from provider API names.

## Available Models (from proxy log)

Full list of 45 valid models from cursor-api-proxy:

```
auto, composer-1, composer-1.5,
gpt-5.1-codex-max, gpt-5.1-codex-max-high, gpt-5.1-codex-mini, gpt-5.1-high,
gpt-5.2, gpt-5.2-high,
gpt-5.2-codex, gpt-5.2-codex-fast, gpt-5.2-codex-high, gpt-5.2-codex-high-fast,
gpt-5.2-codex-low, gpt-5.2-codex-low-fast, gpt-5.2-codex-xhigh, gpt-5.2-codex-xhigh-fast,
gpt-5.3-codex, gpt-5.3-codex-fast, gpt-5.3-codex-high, gpt-5.3-codex-high-fast,
gpt-5.3-codex-low, gpt-5.3-codex-low-fast, gpt-5.3-codex-spark-preview,
gpt-5.3-codex-xhigh, gpt-5.3-codex-xhigh-fast,
gpt-5.4-high, gpt-5.4-high-fast, gpt-5.4-medium, gpt-5.4-medium-fast,
gpt-5.4-xhigh, gpt-5.4-xhigh-fast,
sonnet-4.5, sonnet-4.5-thinking, sonnet-4.6, sonnet-4.6-thinking,
opus-4.5, opus-4.5-thinking, opus-4.6, opus-4.6-thinking,
gemini-3-flash, gemini-3-pro, gemini-3.1-pro,
grok, kimi-k2.5
```

## Model Classification

### Slow Request (7 models)

Unlimited usage, queued during peak — does **not** consume fast quota.

| Model                | Provider    | Notes             |
| -------------------- | ----------- | ----------------- |
| `sonnet-4.5`         | Anthropic   | Claude Sonnet 4.5 |
| `gemini-3-flash`     | Google      | Fast, lightweight |
| `gemini-3-pro`       | Google      |                   |
| `gemini-3.1-pro`     | Google      | Latest Gemini Pro |
| `kimi-k2.5`          | Moonshot AI |                   |
| `grok`               | xAI         |                   |
| `gpt-5.1-codex-mini` | OpenAI      | Smallest codex    |

### Fast Request (26 models)

Consumes from 500 fast requests/month quota. High-priority, instant response.

| Model                         | Provider  | Notes                                |
| ----------------------------- | --------- | ------------------------------------ |
| `auto`                        | Cursor    | Auto-selects optimal model           |
| `composer-1`                  | Cursor    | Agentic coding model                 |
| `composer-1.5`                | Cursor    | Latest Cursor agentic model          |
| `sonnet-4.6`                  | Anthropic | **DEFAULT** — balanced speed/quality |
| `opus-4.5`                    | Anthropic | High capability                      |
| `opus-4.6`                    | Anthropic | Latest Opus                          |
| `gpt-5.2`                     | OpenAI    |                                      |
| `gpt-5.2-high`                | OpenAI    |                                      |
| `gpt-5.2-codex`               | OpenAI    |                                      |
| `gpt-5.2-codex-low`           | OpenAI    |                                      |
| `gpt-5.2-codex-low-fast`      | OpenAI    |                                      |
| `gpt-5.2-codex-fast`          | OpenAI    |                                      |
| `gpt-5.2-codex-high`          | OpenAI    |                                      |
| `gpt-5.2-codex-high-fast`     | OpenAI    |                                      |
| `gpt-5.3-codex`               | OpenAI    |                                      |
| `gpt-5.3-codex-low`           | OpenAI    |                                      |
| `gpt-5.3-codex-low-fast`      | OpenAI    |                                      |
| `gpt-5.3-codex-fast`          | OpenAI    |                                      |
| `gpt-5.3-codex-high`          | OpenAI    |                                      |
| `gpt-5.3-codex-high-fast`     | OpenAI    |                                      |
| `gpt-5.3-codex-spark-preview` | OpenAI    | Preview model                        |
| `gpt-5.4-medium`              | OpenAI    |                                      |
| `gpt-5.4-medium-fast`         | OpenAI    |                                      |
| `gpt-5.4-high`                | OpenAI    |                                      |
| `gpt-5.4-high-fast`           | OpenAI    |                                      |
| `gpt-5.1-high`                | OpenAI    |                                      |

### Max Mode (12 models)

Extended context window / reasoning. Higher cost (~20% upcharge).
Includes all `-thinking` variants (extended reasoning) and `-xhigh`/`-max` variants (ultra quality tier).

| Model                      | Provider  | Notes                       |
| -------------------------- | --------- | --------------------------- |
| `sonnet-4.5-thinking`      | Anthropic | Extended reasoning          |
| `sonnet-4.6-thinking`      | Anthropic | Extended reasoning          |
| `opus-4.5-thinking`        | Anthropic | Extended reasoning          |
| `opus-4.6-thinking`        | Anthropic | Extended reasoning          |
| `gpt-5.2-codex-xhigh`      | OpenAI    | Ultra quality               |
| `gpt-5.2-codex-xhigh-fast` | OpenAI    | Ultra quality, fast variant |
| `gpt-5.3-codex-xhigh`      | OpenAI    | Ultra quality               |
| `gpt-5.3-codex-xhigh-fast` | OpenAI    | Ultra quality, fast variant |
| `gpt-5.4-xhigh`            | OpenAI    | Ultra quality               |
| `gpt-5.4-xhigh-fast`       | OpenAI    | Ultra quality, fast variant |
| `gpt-5.1-codex-max`        | OpenAI    | Max context                 |
| `gpt-5.1-codex-max-high`   | OpenAI    | Max context, high quality   |

## Design Decision

**Approach**: Comment-based grouping in single `CURSOR_MODEL_VALUES` array.

- Keep single flat array (no breaking changes to consumers)
- Add `// === SLOW REQUEST ===`, `// === FAST REQUEST ===`, `// === MAX MODE ===` block comments
- Change `DEFAULT_CURSOR_MODEL` from `'claude-sonnet-4-5'` to `'sonnet-4.6'`
- Remove all old model names (claude-sonnet-4-_, claude-opus-4-_, gemini-2.5-flash, gpt-5-mini, cursor-small)

**Rationale**: YAGNI — no current runtime need to filter by category. Comments serve as documentation without API surface change.

## Files to Change

| File                                                 | Change                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `packages/provider-cursor/src/cursor-plugin.ts`      | Replace `CURSOR_MODEL_VALUES`, update `DEFAULT_CURSOR_MODEL` |
| `packages/provider-cursor/src/cursor-plugin.test.ts` | Update model list assertions                                 |

## Definition of Done

```bash
bun test && bun run typecheck && bun run lint
```
