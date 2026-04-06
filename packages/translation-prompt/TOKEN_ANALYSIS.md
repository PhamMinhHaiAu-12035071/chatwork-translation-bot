# Token Usage Analysis

## Current Prompt Structure (Baseline)

### System Prompt Components

Measured from `src/translation-prompt.ts`:

```typescript
SHARED_SYSTEM = [
  BASE_TRANSLATOR_ROLE,    // ~20 tokens
  CORE_DOCTRINE,           // ~200 tokens
  JAPANESE_RULES,          // ~650 tokens (5 romanization examples)
  ENGLISH_RULES,           // ~80 tokens
  CONSTRAINTS,             // ~130 tokens
  SELF_VERIFICATION,       // ~40 tokens
]

// Additional dynamic sections:
+ CONTEXT_ENFORCEMENT_HEADER   // ~80 tokens (when roomContext present)
+ Room Context (trimmed)        // 0-200 tokens (variable)
+ Translation Style Section     // 50-150 tokens (varies by style)
+ Keyword System Hint           // 0-100 tokens (variable)
```

### Baseline Token Estimates (Per Request)

| Component | Tokens | Notes |
|-----------|--------|-------|
| BASE_TRANSLATOR_ROLE | ~20 | Single sentence role definition |
| CORE_DOCTRINE | ~200 | 15 translation principles |
| JAPANESE_RULES | ~650 | 5 examples + principles + self-check |
| ENGLISH_RULES | ~80 | 4 English-specific principles |
| CONSTRAINTS | ~130 | Output + Security rules |
| SELF_VERIFICATION | ~40 | 3-item checklist |
| **Base System Total** | **~1,120** | Without context/style/keywords |
| CONTEXT_ENFORCEMENT_HEADER | ~80 | When room context present |
| Room Context | 0-200 | Trimmed to 1000 chars max |
| Translation Style (NATURAL_CASUAL) | ~150 | Longest style profile |
| Translation Style (PROFESSIONAL_BUSINESS) | ~100 | Medium profile |
| Translation Style (TECHNICAL) | ~80 | Shortest profile |
| Keyword System Hint | 0-100 | Variable by keyword count |
| **Typical System Total** | **1,350-1,500** | With context + style + keywords |

### User Prompt Components

| Component | Tokens | Notes |
|-----------|--------|-------|
| Task description | ~40 | "Task: Translate..." + style reminder |
| XML tags | ~10 | `<TRANSLATE_TEXT>` or `<TRANSLATE_SEGMENTS>` |
| Message context block | 0-50 | Optional for structured prompts |
| Source text/segments | 50-2000+ | Variable by message length |
| **Typical User Total** | **100-2,100** | Varies by message length |

### Total Request Token Budget

| Scenario | System | User | **Total** |
|----------|--------|------|-----------|
| **Short message (no context)** | 1,200 | 150 | **~1,350** |
| **Medium message (with context)** | 1,450 | 350 | **~1,800** |
| **Long message (with context + keywords)** | 1,500 | 1,500 | **~3,000** |

## Optimization Opportunities

### 1. JAPANESE_RULES (650 tokens → 400 tokens target)
- **Current**: 5 romanization examples
- **Optimized**: 3 core pattern examples
- **Research**: 3-5 examples achieve 94% compliance (few-shot learning)
- **Savings**: ~250 tokens (38% reduction)

### 2. SELF_VERIFICATION (40 tokens → 0 tokens)
- **Issue**: Redundant with inline verification in JAPANESE_RULES (lines 63-64)
- **Research**: Single-location verification clearer for LLMs than dual checklists
- **Action**: Remove entirely
- **Savings**: 40 tokens (100% reduction)

### 3. CORE_DOCTRINE (200 tokens → 170 tokens target)
- **Current**: 15 verbose principles
- **Optimized**: 12 concise directives
- **Strategy**: Merge overlapping principles, remove redundancy
- **Savings**: ~30 tokens (15% reduction)

### 4. CONSTRAINTS (130 tokens → 90 tokens target)
- **Current**: Separate Output + Security sections
- **Optimized**: Consolidated rules with bullets
- **Savings**: ~40 tokens (31% reduction)

### 5. User Prompt Structure (40 tokens → 15 tokens target)
- **Current**: Verbose task description + style reminder
- **Optimized**: Minimal task directive
- **Savings**: ~25 tokens (63% reduction)

## Expected Impact

### Token Savings Summary

| Component | Before | After | Savings | % |
|-----------|--------|-------|---------|---|
| JAPANESE_RULES | 650 | 400 | 250 | -38% |
| SELF_VERIFICATION | 40 | 0 | 40 | -100% |
| CORE_DOCTRINE | 200 | 170 | 30 | -15% |
| CONSTRAINTS | 130 | 90 | 40 | -31% |
| User Prompt | 40 | 15 | 25 | -63% |
| **Total System** | **1,120** | **735** | **385** | **-34%** |

### Projected Request Sizes (After Optimization)

| Scenario | System (Before) | System (After) | User (Before) | User (After) | Total Savings |
|----------|-----------------|----------------|---------------|--------------|---------------|
| Short message | 1,200 | 815 | 150 | 125 | **-410 (-30%)** |
| Medium message | 1,450 | 1,065 | 350 | 325 | **-410 (-23%)** |
| Long message | 1,500 | 1,115 | 1,500 | 1,475 | **-410 (-14%)** |

### Business Impact

**Per-Request Benefits:**
- **Token savings**: 385-410 tokens average (-25-30%)
- **Cost savings**: $0.0001-0.0005 per request (provider-dependent)
- **Latency improvement**: ~1-3 seconds (fewer tokens to process)

**Monthly Volume (estimated 10,000 requests):**
- **Token savings**: ~4M tokens/month
- **Cost savings**: $1-5/month
- **Cumulative latency savings**: ~5-8 hours/month

**Quality Target:**
- Maintain ≥93% accuracy (validated via A/B testing)
- Preserve romanization compliance
- Ensure style differentiation

## Measurement Plan

### Step 1: Exact Token Measurement Script

Create `scripts/measure-prompt-tokens.ts` to measure:
1. Current baseline with Gemini API (`model.countTokens()`)
2. Current baseline with OpenAI API (`completion.usage.prompt_tokens`)
3. Update this document with exact measurements

### Step 2: Optimization Implementation

After measuring baseline:
1. Create optimized versions of each component
2. Implement feature flag: `TRANSLATION_PROMPT_VERSION` (baseline | optimized)
3. Re-measure optimized prompt tokens
4. Validate savings match projections

### Step 3: A/B Testing

- Run parallel tests with baseline vs optimized prompts
- Measure quality, latency, and cost
- Validate no degradation in translation accuracy

## Notes

- All token estimates above are **approximate** pending exact API measurements
- Exact counts will be added after running `scripts/measure-prompt-tokens.ts`
- Optimization preserves all functional requirements
- Research citations in `docs/superpowers/specs/` support optimization strategies
