# Analyzing Translation Performance Traces

## Overview

The translation bot generates comprehensive traces for every request, capturing timing, LLM details, and performance metrics. This guide explains how to analyze these traces to identify bottlenecks and optimization opportunities.

## Trace File Location

```
output/
└── traces/
    ├── 2026-04-05/
    │   ├── trace-a1b2c3d4.json
    │   ├── trace-e5f6g7h8.json
    │   └── ...
    └── 2026-04-06/
```

Traces are automatically organized by date in daily folders.

## Trace Schema

Each trace contains:

- **Identity**: `traceId`, `requestId`, `sourceMessageId`, `originType`
- **Timing**: Per-stage durations (preprocessing, llmCall, postprocessing, delivery)
- **LLM Details**: Provider, model, tokens (input/output/total), temperature, prompt version
- **Performance**: Bottleneck analysis, slow request flag (>25s), slow stages (>1s)
- **Opportunities**: Auto-detected optimization hints (cache candidate, fast model candidate, keyword optimization)

## Analysis Commands

### 1. Analyze Single Day

```bash
bun run analyze:traces output/traces/2026-04-05
```

**Output:**

- Summary statistics (total requests, avg latency, P50/P95/P99 percentiles)
- Provider comparison (count, avg LLM time, avg total time, tokens/request)
- Bottleneck identification (stage, occurrences, avg duration)
- Top 10 slow requests
- Optimization opportunities count

### 2. Generate Daily Report

```bash
bun run report:daily 2026-04-05
```

Generates: `docs/analysis/daily-report-2026-04-05.md`

This creates a markdown report with all analysis results, suitable for sharing with team or stakeholders.

### 3. Save Analysis to JSON

```bash
bun run analyze:traces output/traces/2026-04-05 output/analysis/analysis-2026-04-05.json
```

Saves structured analysis data for programmatic processing or integration with monitoring tools.

## Performance SLOs

| Metric               | Target | Alert If |
| -------------------- | ------ | -------- |
| P95 latency          | <21s   | >25s     |
| P99 latency          | <25s   | >30s     |
| Slow requests (>25s) | <10%   | >15%     |
| Delivery failures    | <1%    | >2%      |

## Troubleshooting

### High LLM Time (>30s)

**Possible causes:**

- Long input text (>1000 characters)
- Extended thinking models (Gemini 2.0 Flash Thinking, GPT-4o with thinking)
- Provider rate limiting (429 errors)
- Complex translation style requirements

**Solutions:**

- Consider faster model for simple messages (`gpt-4o-mini`, `gemini-2.0-flash-exp`)
- Review provider status and rate limits
- Check provider-specific rate limiting and quotas

### High Non-LLM Overhead (>2s)

**Possible causes:**

- Keyword processing with >100 keywords
- Delivery network latency to Chatwork API
- Synchronous logging (async disabled)
- HTTP connection pool exhausted

**Solutions:**

- Verify `ENABLE_KEYWORD_CACHE=true` (default)
- Check `ENABLE_HTTP_KEEPALIVE=true` (default)
- Verify `USE_ASYNC_LOGGING=true` (default)
- Check network latency to Chatwork API (should be <300ms)
- Review circuit breaker status for Chatwork API

### Frequent Circuit Breaker Opens

**Possible causes:**

- Chatwork API downtime or degraded performance
- LLM provider rate limits or outages
- Network issues

**Solutions:**

- Check `CHATWORK_API_FAILURE_THRESHOLD` (default: 5 failures)
- Check `LLM_PROVIDER_FAILURE_THRESHOLD` (default: 3 failures)
- Review Docker logs for circuit breaker events
- Adjust thresholds if seeing false positives

## Daily Review Checklist

- [ ] Review P95 latency trend (should be decreasing or stable)
- [ ] Check slow request percentage (<10% target)
- [ ] Identify bottleneck stages (llmCall typically dominant)
- [ ] Review optimization opportunities
- [ ] Compare provider performance (identify fastest/most reliable)
- [ ] Check for delivery failures (<1% target)
- [ ] Verify circuit breaker health (should stay CLOSED)

## Example Analysis Workflow

1. **Generate daily report:**

   ```bash
   bun run report:daily
   ```

2. **Check for anomalies:**

   ```bash
   bun run analyze:traces output/traces/$(date +%Y-%m-%d) | grep -A 5 "Slow Requests"
   ```

3. **Investigate specific trace:**

   ```bash
   cat output/traces/2026-04-05/trace-<traceId>.json | jq '.'
   ```

4. **Compare with previous day:**
   ```bash
   bun run analyze:traces output/traces/2026-04-05 > today.txt
   bun run analyze:traces output/traces/2026-04-04 > yesterday.txt
   diff today.txt yesterday.txt
   ```

## Integration with Monitoring Tools

The JSON output can be integrated with:

- **Grafana**: Import JSON metrics for dashboards
- **Prometheus**: Convert to metrics format
- **Alerting systems**: Query for SLO violations

Example metric extraction:

```bash
cat output/analysis/analysis-2026-04-05.json | jq '.summary.p95'
```

## Related Documentation

- [Performance Monitoring Guide](./performance-monitoring.md)
- [Translator Observability](./translator-observability.md)
- [Performance Optimization Plan](../plans/2026-04-05-performance-optimization.md)
