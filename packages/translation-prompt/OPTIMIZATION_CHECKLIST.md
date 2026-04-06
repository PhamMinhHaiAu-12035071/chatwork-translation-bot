# Prompt Optimization Checklist

## Phase 2: Prompt Optimization Tasks

Based on baseline audit in `TOKEN_ANALYSIS.md`, the following optimizations are planned:

### ✅ Completed
- [x] Task 8: Baseline audit and token analysis
- [x] Created `TOKEN_ANALYSIS.md` with estimates
- [x] Created `scripts/measure-prompt-tokens.ts` for exact measurements
- [x] Documented current structure and optimization opportunities

### 🎯 Optimization Tasks (Task 9)

#### 1. Optimize JAPANESE_RULES (650 → 400 tokens, -38%)
- [ ] Create `sections/japanese-rules-optimized.ts`
- [ ] Reduce from 5 examples to 3 core patterns
- [ ] Keep: Person name, Company name, Technical term
- [ ] Remove: Abbreviation, Brand examples (already obvious)
- [ ] Merge inline self-check with main text
- [ ] Validate romanization compliance maintained

**Target**: 3 examples, ~400 tokens

#### 2. Remove SELF_VERIFICATION (40 → 0 tokens, -100%)
- [ ] Remove `sections/verification.ts` import
- [ ] Remove from SHARED_SYSTEM array
- [ ] Verify inline self-check in JAPANESE_RULES sufficient
- [ ] Test that verification quality maintained

**Rationale**: Redundant with inline verification (research: single-location clearer)

#### 3. Optimize CORE_DOCTRINE (200 → 170 tokens, -15%)
- [ ] Create `sections/core-optimized.ts`
- [ ] Merge overlapping principles:
  - Combine "naturalness first" + "correct but flat not enough"
  - Merge "preserve formatting" + "keep hyphens"
  - Condense "translate by meaning" + "rewrite strongly"
- [ ] Remove redundant qualifiers
- [ ] Validate all critical principles preserved

**Target**: 12 concise directives, ~170 tokens

#### 4. Optimize CONSTRAINTS (130 → 90 tokens, -31%)
- [ ] Create `sections/constraints-optimized.ts`
- [ ] Consolidate Output + Security into single section
- [ ] Use bullet format instead of paragraphs
- [ ] Merge related rules
- [ ] Validate all security requirements preserved

**Target**: Consolidated rules, ~90 tokens

#### 5. Optimize User Prompt Builder (40 → 15 tokens, -63%)
- [ ] Simplify `buildSingleUserPrompt()` task description
- [ ] Remove verbose "Style reminder" line
- [ ] Keep only essential: task + JSON format + tags
- [ ] Test with all 3 styles
- [ ] Validate output format compliance maintained

**Target**: Minimal task directive, ~15 tokens

#### 6. Feature Flag Implementation
- [ ] Add `TRANSLATION_PROMPT_VERSION` env var (baseline | optimized)
- [ ] Update `translation-prompt.ts` to support both versions
- [ ] Create `buildOptimizedPrompts()` function
- [ ] Add switch logic based on feature flag
- [ ] Default to `baseline` for safe rollout

**Example**:
```typescript
export function buildSingleCallPrompts(
  text: string,
  style: TranslationStyle = DEFAULT_TRANSLATION_STYLE,
  roomContext?: string,
  keywordSystemHint?: string,
): PromptPair {
  const version = process.env['TRANSLATION_PROMPT_VERSION'] ?? 'baseline'
  
  if (version === 'optimized') {
    return buildOptimizedSingleCallPrompts(text, style, roomContext, keywordSystemHint)
  }
  
  // Current baseline implementation
  // ...
}
```

### 📊 Validation Tasks (Task 10)

#### A/B Testing Setup
- [ ] Create test dataset (20 messages per style)
- [ ] Run baseline version on all messages
- [ ] Run optimized version on all messages
- [ ] Collect quality metrics:
  - Romanization accuracy
  - Style differentiation
  - Translation naturalness
  - JSON format compliance

#### Quality Validation
- [ ] Compare baseline vs optimized translations
- [ ] Calculate quality delta per message
- [ ] Ensure ≥93% accuracy maintained
- [ ] Document any quality regressions

#### Performance Validation
- [ ] Measure token savings (target: -30%)
- [ ] Measure latency improvement (target: -1-3s)
- [ ] Measure cost savings
- [ ] Compare against TOKEN_ANALYSIS.md projections

### 🚀 Rollout Tasks

#### Gradual Rollout
- [ ] Deploy with `TRANSLATION_PROMPT_VERSION=baseline` (default)
- [ ] Enable `optimized` for test room only
- [ ] Monitor for 24 hours
- [ ] Collect user feedback
- [ ] Expand to 10% of rooms
- [ ] Monitor for 1 week
- [ ] Expand to 50% of rooms (A/B test)
- [ ] Final decision: rollout or rollback

#### Monitoring
- [ ] Track quality metrics per version
- [ ] Track token usage per version
- [ ] Track latency per version
- [ ] Set up alerts for quality degradation
- [ ] Document learnings

### 📝 Documentation Tasks

- [ ] Update `TOKEN_ANALYSIS.md` with exact measurements (post-script run)
- [ ] Document optimization decisions
- [ ] Update `README.md` if needed
- [ ] Create rollback plan
- [ ] Document A/B test results

## Success Criteria

✅ **Token Savings**: ≥30% reduction (385+ tokens)
✅ **Quality**: ≥93% accuracy maintained
✅ **Latency**: 1-3 seconds faster
✅ **Cost**: $1-5/month savings (10K requests)
✅ **No Regressions**: All functional requirements preserved

## Notes

- All optimizations preserve functional requirements
- Research citations support each optimization strategy
- Feature flag enables safe testing and rollback
- A/B testing validates no quality degradation
