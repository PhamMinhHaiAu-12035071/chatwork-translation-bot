# Provider Benchmarking Guide (Manual Testing)

## Objective

Test different AI providers (Gemini, OpenAI) with various message types to identify the fastest and most cost-effective provider per scenario.

## Test Dataset

**Location**: `input/testing/provider-benchmark.jsonl`

**Coverage**:
- 17 test messages across 4 categories
- Japanese (10 messages) and English (7 messages)
- Includes romanization test cases (6 messages)

| Category | Count | Description |
|----------|-------|-------------|
| Short | 5 | < 100 chars - simple greetings, acknowledgments |
| Medium | 5 | 100-500 chars - progress reports, requests |
| Long | 3 | > 500 chars - meeting minutes, roadmap planning |
| Technical | 4 | Error messages, build failures, performance issues |

## Test Setup

### 1. Configure Test Room

Use room ID `999999` for benchmarking (or create a dedicated test room).

**Via Dashboard**:
- Go to Room Settings
- Set provider and model for testing
- Use `NATURAL_CASUAL` style (default)

**Via Environment** (for testing different providers):
```bash
# Example: Testing Gemini Flash
ROOM_999999_PROVIDER=gemini
ROOM_999999_MODEL=gemini-2.0-flash-exp

# Example: Testing OpenAI
ROOM_999999_PROVIDER=openai
ROOM_999999_MODEL=gpt-4o-mini
```

### 2. Start Translator

```bash
docker-compose up
```

Verify health check:
```bash
curl http://localhost:3000/health
```

## Manual Testing Process

### For Each Provider Configuration

Test matrix: **Provider × Message Category**

| Provider | Model | Short | Medium | Long | Technical |
|----------|-------|-------|--------|------|-----------|
| Gemini | gemini-2.0-flash-exp | 5 | 5 | 3 | 4 |
| Gemini | gemini-2.0-flash-thinking-exp-01-21 | 5 | 5 | 3 | 4 |
| OpenAI | gpt-4o-mini | 5 | 5 | 3 | 4 |

**Total**: 51 translation requests (3 providers × 17 messages)

### Testing Steps

#### Option A: Send via Chatwork (Realistic Testing)

1. **Configure provider** for test room via dashboard or env
2. **Open** `input/testing/provider-benchmark.jsonl` in editor
3. **For each message**:
   - Copy the `body` field value (e.g., `/translate vi お疲れ様です...`)
   - Send in Chatwork test room
   - Wait for translation response
   - Note subjective speed (Fast/Medium/Slow)
4. **Collect traces**:
   - After each test, find the output trace in `output/` folder
   - Copy to organized folder: `output/benchmarks/<provider>/<model>/<message-id>.json`
5. **Repeat** for all 17 messages
6. **Switch provider** configuration and repeat

#### Option B: Use Dataset Runner (Automated)

**Prerequisites**: `DATASET_AUTORUN=true` in `.env`

1. **Configure provider** for test room
2. **Copy dataset** to runner input folder:
   ```bash
   cp input/testing/provider-benchmark.jsonl input/dataset-runner/benchmark-<provider>.jsonl
   ```
3. **Start dataset runner**:
   ```bash
   docker-compose up dataset-runner
   ```
4. **Monitor** logs for completion
5. **Collect traces** from `output/` folder
6. **Organize** by provider:
   ```bash
   mkdir -p output/benchmarks/<provider>/<model>
   mv output/*.json output/benchmarks/<provider>/<model>/
   ```
7. **Switch provider** and repeat

## Data Collection

### Per Translation Request

Record the following from output trace JSON:

- ✅ **Provider** + **Model** (e.g., `gemini/gemini-2.0-flash-exp`)
- ✅ **Message category** (short/medium/long/technical)
- ✅ **Source language** (ja/en)
- ✅ **Total time** (webhook received → response sent)
- ✅ **LLM time** (from trace timing data)
- ✅ **Token usage** (prompt + completion)
- ✅ **Quality assessment** (1-5 stars):
  - 5: Perfect translation, natural Vietnamese
  - 4: Good, minor unnaturalness
  - 3: Acceptable, some awkward phrasing
  - 2: Poor, significant issues
  - 1: Failed or unusable

### Romanization Validation

For 6 messages with `expectedRomanization` metadata:

- ✅ Check all expected terms are romanized correctly
- ✅ Verify Hepburn romanization for person names
- ✅ Confirm consistency (same term = same romanization)

## Analysis (AI-Assisted)

After collecting all traces (51 files):

### Step 1: Organize Traces

```bash
output/benchmarks/
├── gemini/
│   ├── gemini-2.0-flash-exp/
│   │   ├── short-ja-1.json
│   │   ├── short-ja-2.json
│   │   └── ... (17 files)
│   └── gemini-2.0-flash-thinking-exp-01-21/
│       └── ... (17 files)
└── openai/
    └── gpt-4o-mini/
        └── ... (17 files)
```

### Step 2: Request AI Analysis

**Prompt for AI**:
```
Analyze provider performance benchmarks from 51 translation traces.

For each provider (Gemini Flash, Gemini Thinking, OpenAI 4o-mini):
1. Calculate P50, P95, P99 latency
2. Average time by message category (short/medium/long/technical)
3. Token usage and estimated cost per request
4. Quality score by category

Compare:
- Speed vs quality trade-offs
- Cost efficiency per provider
- Romanization accuracy
- Best provider per message type

Format: Markdown table with recommendations.
```

### Step 3: Review AI Output

AI will generate analysis report with:

**Performance Metrics**:
| Provider | Model | P50 Latency | P95 Latency | Avg Cost | Quality |
|----------|-------|-------------|-------------|----------|---------|
| Gemini | flash-exp | 8.2s | 12.1s | $0.0003 | 4.2/5 |
| Gemini | thinking-exp | 18.5s | 24.3s | $0.0008 | 4.7/5 |
| OpenAI | gpt-4o-mini | 6.5s | 9.8s | $0.0004 | 4.1/5 |

**Recommendations**:
- **Default provider**: Best balance of speed/cost/quality
- **Thinking mode**: When to use high-quality models
- **Cost optimization**: Cheapest provider per category
- **Temperature settings**: Optimal values per provider

### Step 4: Update Configuration

Based on analysis results, update room configuration:

**Dashboard Settings**:
- Set default provider per room type
- Configure model selection logic
- Adjust temperature if needed

**Documentation**:
- Update `docs/operations/provider-selection.md`
- Document cost expectations
- Add quality benchmarks

## Success Criteria

✅ **Coverage**: All 17 messages tested with all 3 providers (51 total)
✅ **Romanization**: All 6 test cases pass validation
✅ **Quality**: Average quality score ≥4.0 for selected provider
✅ **Speed**: P95 latency < 15s for default provider
✅ **Cost**: Average cost < $0.0005 per request

## Notes

### Cost Estimation

Based on typical pricing (subject to change):

| Provider | Model | Input | Output | Est. Cost/Request |
|----------|-------|-------|--------|-------------------|
| Gemini | flash-exp | Free | Free | $0 |
| Gemini | thinking-exp | $0.001/1K | $0.004/1K | $0.0003-0.0008 |
| OpenAI | gpt-4o-mini | $0.00015/1K | $0.0006/1K | $0.0002-0.0005 |

### Quality vs Speed Trade-offs

- **Fast models** (Flash, 4o-mini): Best for short/medium messages
- **Thinking models**: Reserve for long/technical messages requiring deep analysis
- **Hybrid approach**: Route by message complexity

### Romanization Patterns

Test messages include:
- Person names: 佐々木さん → Sasaki-san
- Company names: デキスパート基本部 → DExpert Kihon-bu
- Technical terms: 2nd開発 → Phát triển giai đoạn 2
- Abbreviations: MTG (keep as-is)
- Brands: Redis (keep as-is)

## Troubleshooting

**Issue**: Translations not appearing
- Check translator logs: `docker-compose logs -f translator`
- Verify room configuration in dashboard
- Confirm API keys are set correctly

**Issue**: Output traces not found
- Check `output/` directory permissions
- Verify `PERSIST_OUTPUT=true` in `.env`
- Look for errors in translator logs

**Issue**: Quality seems low
- Try different temperature settings (0.3-0.7 range)
- Test with different models
- Verify prompt structure in logs

## Next Steps After Benchmarking

1. **Analyze results** using AI-assisted analysis
2. **Update default provider** in dashboard
3. **Document findings** in `docs/operations/provider-selection.md`
4. **Optimize costs** by selecting appropriate models per message type
5. **Monitor production** performance with selected configuration

---

**Questions?** Check `docs/operations/translator-observability.md` for trace format details.
