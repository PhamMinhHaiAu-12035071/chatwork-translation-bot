# Prompt A/B Testing Guide

## Overview

This guide walks through testing the optimized prompt version against the baseline to validate:
- **Token reduction**: Target -25% to -35% input tokens
- **Performance**: Response time within ±5% of baseline
- **Quality**: Translation accuracy, romanization, style, naturalness maintained

---

## Prerequisites

1. **Translator service running** with tracing enabled:
   ```bash
   docker-compose up translator
   ```

2. **Test dataset generated**:
   ```bash
   bun run scripts/generate-ab-test-dataset.ts
   ```
   Output: `input/testing/prompt-ab-test.jsonl` (100 messages)

3. **Dedicated test room** configured:
   - Room ID: `777777` (or create a dedicated room)
   - Provider: `gemini` or `openai`
   - Model: Your preferred model
   - Style: `NATURAL_CASUAL` (default)

---

## Testing Process

### Phase 1: Baseline Testing (Original Prompts)

**Step 1:** Configure baseline version

```bash
# .env or docker-compose.yml
TRANSLATION_PROMPT_VERSION=baseline
```

**Step 2:** Restart translator

```bash
docker-compose restart translator
```

**Step 3:** Send test messages

**Option A: Manual (via Chatwork)**
- Send messages from `input/testing/prompt-ab-test.jsonl` one by one
- Wait for translations
- Traces saved to `output/777777/`

**Option B: Automated (via dataset-runner)**
```bash
# Configure dataset runner
CHATWORK_ORIGINAL_ROOM_ID=777777
DATASET_AUTORUN=true

# Run
docker-compose up dataset-runner
```

**Step 4:** Wait for completion

Monitor translator logs:
```bash
docker-compose logs -f translator | grep "Translation completed"
```

Expected: 100 traces in `output/777777/`

**Step 5:** Backup baseline results

```bash
mkdir -p output/777777-baseline
cp output/777777/*.json output/777777-baseline/
```

---

### Phase 2: Optimized Testing (New Prompts)

**Step 1:** Configure optimized version

```bash
# .env or docker-compose.yml
TRANSLATION_PROMPT_VERSION=optimized
```

**Step 2:** Clear output directory

```bash
rm output/777777/*.json
# Or move to separate folder for comparison
```

**Step 3:** Restart translator

```bash
docker-compose restart translator
```

**Step 4:** Send SAME test messages again

Use the same `prompt-ab-test.jsonl` dataset.

**Step 5:** Wait for completion

Monitor for 100 new traces in `output/777777/`

---

### Phase 3: Comparison Analysis

**Step 1:** Run comparison script

```bash
bun run scripts/compare-prompts.ts 777777
```

**Output:**
```
📊 Prompt Optimization Comparison Report

🌍 Overall Performance

Baseline:
  Traces:        100
  Avg LLM time:  2847ms
  Avg tokens in: 1347
  Avg tokens out:245
  Avg total:     3412ms

Optimized:
  Traces:        100
  Avg LLM time:  2156ms
  Avg tokens in: 970
  Avg tokens out:243
  Avg total:     2821ms

Delta:
  LLM time:      -691ms (-24.3%)
  Tokens in:     -377 (-28.0%)
  Tokens out:    -2 (-0.8%)
  Total time:    -591ms (-17.3%)

✅ Success Criteria Validation

1. Token reduction: 28.0% (target: -25% to -35%)
   ✅ PASS: Achieved target

2. Response time: -17.3%
   ✅ PASS: Improved performance

3. Quality (manual review required):
   [ ] Romanization accuracy maintained
   [ ] Style differentiation preserved
   [ ] Translation naturalness unchanged
   [ ] JSON format compliance 100%
```

**Step 2:** Manual quality review

Compare 10-20 random translations side-by-side:

```bash
# Extract sample pairs for manual review
bun run scripts/extract-samples.ts 777777 20
```

Review checklist:
- [ ] Japanese names romanized correctly (佐々木さん → Sasaki-san)
- [ ] Company names romanized (デキスパート → DExpert)
- [ ] Technical terms translated (2nd開発 → giai đoạn 2)
- [ ] English casual tone preserved (heads up, FYI → natural Vietnamese)
- [ ] Mixed content handled seamlessly
- [ ] Long messages maintain quality
- [ ] Technical content (errors, code) accurate
- [ ] Edge cases (profanity, URLs) handled appropriately

**Step 3:** Review detailed report

```bash
cat output/777777/comparison-report.json
```

Focus on:
- Category-specific performance (romanization, casual, mixed, long, technical)
- Token distribution (input vs output)
- Time breakdown (LLM vs total)

---

## Success Criteria

### Quantitative Metrics

| Metric | Target | Acceptance Range |
|--------|--------|------------------|
| Input token reduction | -30% | -25% to -35% |
| Output token change | 0% | ±5% |
| LLM response time | -10% to +5% | -20% to +10% |
| Total time | -5% to +5% | -10% to +10% |

### Qualitative Checks

1. **Romanization Accuracy** (Critical):
   - All Japanese names/companies romanized
   - Hepburn romanization used
   - Consistent throughout message

2. **Style Differentiation** (High):
   - NATURAL_CASUAL still casual
   - PROFESSIONAL_BUSINESS still formal
   - TECHNICAL still precise

3. **Translation Naturalness** (High):
   - Native Vietnamese phrasing
   - Context-appropriate register
   - No translationese

4. **JSON Format** (Critical):
   - 100% valid JSON
   - Required fields present
   - No truncation/corruption

---

## Interpretation Guidelines

### Token Reduction

**Expected:** -25% to -35% input tokens
- **< -25%**: Optimization too aggressive, may impact quality
- **-25% to -35%**: ✅ Ideal range
- **> -35%**: Less optimization than expected, investigate

### Performance Change

**Expected:** -10% to +5% total time
- **< -10%**: Excellent! Token reduction improved latency
- **-10% to +5%**: ✅ Acceptable range (network variance)
- **> +5%**: Investigate - may indicate quality issues requiring more LLM iterations

### Quality Issues

**If any quality metric fails:**
1. Document specific failures with examples
2. Identify pattern (category, length, content type)
3. Refine optimized prompts to address
4. Re-run A/B test
5. Do NOT deploy until quality matches baseline

---

## Common Issues & Troubleshooting

### Issue: "Insufficient traces for comparison"

**Cause:** Not enough traces in output directory

**Fix:**
```bash
# Check trace count
ls -la output/777777/*.json | wc -l

# Should be ~100 for each version
```

### Issue: Token counts similar between versions

**Cause:** TRANSLATION_PROMPT_VERSION not applied

**Fix:**
```bash
# Verify env var
docker-compose exec translator printenv | grep TRANSLATION_PROMPT_VERSION

# Should show 'baseline' or 'optimized'
```

### Issue: Response time significantly slower with optimized

**Cause:** Optimized prompt may be less clear, causing more LLM processing

**Fix:**
1. Review LLM provider logs for retry patterns
2. Check if JSON parsing failures increased
3. Refine optimized prompts for clarity
4. Consider adding back some removed context

### Issue: Quality degradation in specific category

**Cause:** Category-specific optimization too aggressive

**Fix:**
1. Identify failing category (romanization, casual, etc.)
2. Review optimized prompt sections for that aspect
3. Add back essential instructions
4. Re-test with category-specific subset

---

## Next Steps After Successful A/B Test

### 1. Gradual Rollout

**Stage 1: Staging (1 week)**
```bash
# staging .env
TRANSLATION_PROMPT_VERSION=optimized
```
Monitor for quality issues.

**Stage 2: Production 10% (1 week)**
```bash
# Use feature flag with random sampling
# If traceId hash % 10 == 0, use optimized
```

**Stage 3: Production 50% (1 week)**
```bash
# If traceId hash % 2 == 0, use optimized
```

**Stage 4: Production 100%**
```bash
# .env
TRANSLATION_PROMPT_VERSION=optimized
```

### 2. Documentation Updates

- [ ] Update `packages/translation-prompt/README.md`
- [ ] Document optimization decisions in `TOKEN_ANALYSIS.md`
- [ ] Update `.env.example` default to `optimized`
- [ ] Add optimization changelog entry

### 3. Performance Monitoring

Track for 1 month:
- Average input tokens (should stay -30%)
- Average response time (should improve or stay same)
- Error rate (should stay same)
- User feedback (monitor support tickets)

### 4. Cost Analysis

Calculate monthly savings:
```
Token reduction: 377 tokens/request
Avg requests/month: 100,000
Token cost: $0.10/1M tokens (example)

Monthly savings: 100,000 × 377 × 0.0000001 = $3.77
Annual savings: $45.24
```

(Actual savings depend on your provider pricing and volume)

---

## Rollback Procedure

If critical quality issues found post-deployment:

**Immediate rollback:**
```bash
# .env
TRANSLATION_PROMPT_VERSION=baseline

# Restart
docker-compose restart translator
```

**Investigate:**
1. Collect failing examples
2. Identify root cause
3. Create fix
4. Re-run A/B test
5. Gradual rollout again

---

## Appendix: Dataset Coverage

The `prompt-ab-test.jsonl` dataset includes:

| Category | Count | Purpose |
|----------|-------|---------|
| Japanese romanization | 30 | Test romanization accuracy |
| English casual | 20 | Test tone preservation |
| Mixed content | 20 | Test language switching |
| Long messages | 15 | Test context handling |
| Technical | 15 | Test technical accuracy |

**Total:** 100 messages

**Key scenarios:**
- Person names (佐々木さん, 田中さん)
- Company names (デキスパート基本部)
- Technical compounds (2nd開発)
- Casual phrases (heads up, FYI, btw)
- Mixed Japanese + English
- Meeting minutes and roadmaps
- Error messages and code
- Special characters and profanity

---

## Summary

1. ✅ Generate dataset: `bun run scripts/generate-ab-test-dataset.ts`
2. ✅ Test baseline: `TRANSLATION_PROMPT_VERSION=baseline` → 100 messages
3. ✅ Test optimized: `TRANSLATION_PROMPT_VERSION=optimized` → 100 messages
4. ✅ Compare: `bun run scripts/compare-prompts.ts 777777`
5. ✅ Manual quality review
6. ✅ If passed: Gradual rollout
7. ✅ Monitor for 1 month

**Target:** -30% tokens, quality maintained, ±5% performance
