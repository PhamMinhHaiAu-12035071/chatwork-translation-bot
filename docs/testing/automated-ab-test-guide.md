# Automated A/B Testing Guide

## Overview

Script tự động để test baseline prompts vs optimized prompts mà không cần setup Chatwork hay dataset-runner.

**Features:**
- ✅ Tự động test 15 messages đại diện cho 6 categories
- ✅ Gọi trực tiếp OpenAI API (gpt-4o-mini)
- ✅ So sánh token usage và response time
- ✅ Generate báo cáo chi tiết
- ✅ Validate success criteria tự động

---

## Quick Start

### Bước 1: Chuẩn bị API Key

Lấy OpenAI API key từ: https://platform.openai.com/api-keys

### Bước 2: Set biến môi trường

**Option A: Export trong terminal**
```bash
export TEMP_OPENAI_API_KEY=sk-proj-your-key-here
```

**Option B: Thêm vào .env**
```bash
echo "TEMP_OPENAI_API_KEY=sk-proj-your-key-here" >> .env
```

### Bước 3: Chạy script

```bash
bun run scripts/automated-ab-test.ts
```

**Expected output:**
```
🧪 Starting Automated A/B Test

Testing 15 messages...
Models: Baseline vs Optimized prompts
Provider: OpenAI (gpt-4o-mini)

[1/15] Testing: test-01 (japanese-romanization)
  Baseline... 1347 tokens in, 2847ms
  Optimized... 970 tokens in, 2156ms
[2/15] Testing: test-02 (japanese-romanization)
  Baseline... 1352 tokens in, 2910ms
  Optimized... 975 tokens in, 2203ms
...
[15/15] Testing: test-15 (edge-cases)
  Baseline... 1340 tokens in, 2801ms
  Optimized... 965 tokens in, 2142ms

✅ Testing complete!

================================================================================

📊 Automated A/B Test Results

================================================================================

🌍 Overall Performance

Baseline:
  Tests:         15
  Avg tokens in: 1347
  Avg tokens out:243
  Avg time:      2847ms

Optimized:
  Tests:         15
  Avg tokens in: 970
  Avg tokens out:241
  Avg time:      2156ms

Delta:
  Tokens in:     -377 (-28.0%)
  Tokens out:    -2 (-0.8%)
  Time:          -691ms (-24.3%)


📂 By Category

--------------------------------------------------------------------------------

japanese-romanization: 1350 → 973 (-27.9%)
english-casual: 1342 → 965 (-28.1%)
mixed-content: 1349 → 971 (-28.0%)
long-messages: 1445 → 1048 (-27.5%)
technical: 1339 → 964 (-28.0%)
edge-cases: 1340 → 965 (-28.0%)


✅ Success Criteria

--------------------------------------------------------------------------------

1. Token reduction: -28.0%
   ✅ PASS: Target -25% to -35%

2. Response time: -24.3%
   ✅ PASS: Within ±10% tolerance

3. Quality:
   ✅ No API errors (0 failures)
   ✅ Valid JSON responses (0 invalid)


💡 Recommendation

--------------------------------------------------------------------------------

✅ All criteria passed! Optimized prompts are ready for deployment.

Next steps:
1. Review sample translations for quality
2. Update TRANSLATION_PROMPT_VERSION=optimized in production
3. Monitor for 1 week

================================================================================

📄 Detailed results saved: output/ab-test-results.json
```

---

## Test Coverage

Script test 15 messages across 6 categories:

| Category | Messages | Examples |
|----------|----------|----------|
| Japanese romanization | 5 | 佐々木さん, デキスパート基本部, 2nd開発チーム |
| English casual | 3 | "Thanks for the heads up!", "FYI - ..." |
| Mixed content | 3 | "MTGの件、佐々木さんに確認しました。Tomorrow at 2pm works." |
| Long messages | 1 | Meeting minutes with multiple participants |
| Technical | 2 | Error messages, build failures |
| Edge cases | 1 | URLs, special characters |

**Total:** 15 messages (30 API calls: 15 baseline + 15 optimized)

---

## Cost Estimate

**Model:** gpt-4o-mini
- Input: ~1,350 tokens × 15 baseline + ~970 tokens × 15 optimized = ~34,800 tokens
- Output: ~245 tokens × 30 calls = ~7,350 tokens

**Pricing (as of April 2024):**
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

**Total cost per test:** ~$0.01 USD (rất rẻ!)

---

## Output Files

**1. Console report** (như trên)
- Overall metrics
- Category breakdown
- Success criteria validation
- Recommendations

**2. JSON report** (`output/ab-test-results.json`)
- Full results for all 30 tests
- Individual translations
- Token counts per message
- Response times per message

Example structure:
```json
{
  "summary": {
    "baseline": { "avgTokensInput": 1347, ... },
    "optimized": { "avgTokensInput": 970, ... },
    "delta": { "tokensInput": -377, "tokensInputPercent": -28.0, ... }
  },
  "byCategory": [...],
  "results": [
    {
      "testId": "test-01",
      "category": "japanese-romanization",
      "sourceText": "佐々木さんに確認をお願いします。",
      "version": "baseline",
      "tokensInput": 1347,
      "tokensOutput": 243,
      "tokensTotal": 1590,
      "responseTimeMs": 2847,
      "translated": "Vui lòng xác nhận với Sasaki-san (佐々木さん)."
    },
    ...
  ]
}
```

---

## Success Criteria

Script tự động validate 3 criteria:

### 1. Token Reduction ✅
**Target:** -25% to -35% input tokens

**Pass if:**
- Delta between -25% and -35%
- Optimized prompt uses significantly fewer tokens
- Output tokens roughly unchanged (±5%)

### 2. Response Time ✅
**Target:** Within ±10% of baseline

**Pass if:**
- Total time change between -10% and +10%
- No significant performance degradation
- Ideally improved due to fewer tokens

### 3. Quality ✅
**Checked automatically:**
- No API errors
- All responses valid JSON
- All responses contain `translated` field

**Manual review needed:**
- Romanization accuracy (佐々木さん → Sasaki-san)
- Translation naturalness
- Style preservation

---

## Troubleshooting

### Error: "OpenAI API key not found"

**Fix:**
```bash
# Option 1: Export
export TEMP_OPENAI_API_KEY=sk-proj-...

# Option 2: Add to .env
echo "TEMP_OPENAI_API_KEY=sk-proj-..." >> .env

# Verify
echo $TEMP_OPENAI_API_KEY
```

### Error: "Rate limit exceeded"

**Cause:** Too many requests too fast

**Fix:**
- Script has 500ms delay between calls
- Wait 1 minute and retry
- Upgrade OpenAI plan if needed

### Error: "Cannot find module 'openai'"

**Fix:**
```bash
bun install
# or
bun add -d openai
```

### Tokens không giảm như expected

**Possible causes:**
1. `TRANSLATION_PROMPT_VERSION` not applied correctly
2. Prompts not built with correct version
3. Cache issue

**Fix:**
```bash
# Clear Bun cache
rm -rf node_modules/.cache

# Restart and retry
bun run scripts/automated-ab-test.ts
```

---

## Manual Quality Review

Sau khi script chạy xong, review sample translations:

**1. Check romanization:**
```bash
# Extract Japanese tests
cat output/ab-test-results.json | jq '.results[] | select(.category == "japanese-romanization")'
```

**2. Check casual tone:**
```bash
# Extract English casual tests
cat output/ab-test-results.json | jq '.results[] | select(.category == "english-casual")'
```

**3. Compare side-by-side:**
```bash
# Create comparison file
bun run scripts/extract-comparison.ts
```

---

## Next Steps After Passing

### 1. Production Deployment

**Staging first:**
```bash
# .env (staging)
TRANSLATION_PROMPT_VERSION=optimized
```

Test for 1 week, monitor:
- Translation quality
- User feedback
- Error rates

**Production gradual rollout:**

Week 1: 10%
```typescript
// In translator service
const useOptimized = Math.random() < 0.1
process.env.TRANSLATION_PROMPT_VERSION = useOptimized ? 'optimized' : 'baseline'
```

Week 2: 50%
```typescript
const useOptimized = Math.random() < 0.5
```

Week 3: 100%
```bash
TRANSLATION_PROMPT_VERSION=optimized
```

### 2. Monitoring

Track for 1 month:
- Average token usage (should stay -28%)
- Average response time (should improve or stay same)
- Error rate (should stay same)
- Support tickets (monitor for quality issues)

### 3. Cost Savings

Calculate monthly savings:
```
Token reduction: 377 tokens/request
Monthly requests: 100,000 (example)
Token cost: $0.15/1M input tokens (gpt-4o-mini)

Monthly savings: 100,000 × 377 × 0.00000015 = $5.66
Annual savings: $67.92
```

(Savings depend on your provider, model, and volume)

---

## Advanced Usage

### Test with different model

Edit script, change model:
```typescript
const completion = await client.chat.completions.create({
  model: 'gpt-4o',  // or 'gpt-4', 'gpt-3.5-turbo'
  ...
})
```

### Test with more messages

Edit `SAMPLE_MESSAGES` array in script:
```typescript
const SAMPLE_MESSAGES = [
  // Add more messages here
  '/translate vi Your message...',
]
```

### Test with different styles

Edit `style` variable:
```typescript
const style: TranslationStyle = 'PROFESSIONAL_BUSINESS'  // or 'TECHNICAL'
```

---

## Comparison: Manual vs Automated Testing

| Aspect | Manual (prompt-ab-testing-guide.md) | Automated (This Script) |
|--------|-------------------------------------|-------------------------|
| Setup | Complex (Chatwork, dataset-runner) | Simple (just API key) |
| Messages tested | 115 | 15 (representative) |
| Time | ~1 hour | ~2 minutes |
| Cost | Production usage | ~$0.01 |
| Quality check | Full workflow | Prompt-only |
| Dependencies | Chatwork API, room config | OpenAI API only |

**When to use automated:**
- Quick validation of prompt changes
- Development/testing phase
- Cost-conscious testing
- CI/CD integration

**When to use manual:**
- Final production validation
- Full end-to-end testing
- Chatwork-specific features
- Large-scale quality assurance

---

## Summary

✅ **Fast:** 2 phút thay vì 1 giờ  
✅ **Cheap:** ~$0.01 thay vì production cost  
✅ **Simple:** Chỉ cần OpenAI API key  
✅ **Automated:** Tự động validate success criteria  
✅ **Reliable:** Test trực tiếp prompts, không qua nhiều layers

**Recommended workflow:**
1. ✅ Run automated test first (this script)
2. ✅ If passed, deploy to staging
3. ✅ Run manual test on staging (full workflow)
4. ✅ If passed, gradual production rollout

Good luck! 🚀
