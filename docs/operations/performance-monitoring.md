# Performance Monitoring

## Overview

This guide covers real-time monitoring, alerting, and performance trend analysis for the Chatwork Translation Bot.

## Real-Time Monitoring

### Docker Logs

```bash
# Follow live logs
docker logs translator -f

# Filter by trace events (performance summary per request)
docker logs translator | grep translation_trace

# Search for errors
docker logs translator | grep '"level":"error"'

# Search for slow requests
docker logs translator | grep '"isSlowRequest":true'

# Check circuit breaker events
docker logs translator | grep 'circuit_breaker'
```

### Key Log Events

| Event | Description | When to Alert |
|-------|-------------|---------------|
| `translation_trace` | Per-request trace summary with timing | totalMs >25000 |
| `translation_delivery_completed` | Successful delivery to Chatwork | N/A (success) |
| `translation_delivery_failed` | Delivery error (retries exhausted) | Always |
| `circuit_breaker_opened` | Too many failures, circuit opened | Always |
| `circuit_breaker_closed` | Circuit recovered | Info only |

### JSON Log Structure

```json
{
  "level": "info",
  "event": "translation_trace",
  "traceId": "a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6",
  "totalMs": 18500,
  "bottleneck": "llmCall",
  "provider": "gemini",
  "model": "gemini-2.0-flash-exp"
}
```

## Metrics Dashboard

### Current Performance (Last Hour)

```bash
# Analyze traces from last hour
TODAY=$(date +%Y-%m-%d)
find output/traces/$TODAY -name "trace-*.json" -mmin -60 | \
  wc -l | \
  echo "Requests in last hour: $(cat)"
```

### Provider Comparison

```bash
# Group traces by provider
bun run analyze:traces output/traces/$(date +%Y-%m-%d) | \
  grep -A 10 "By Provider"
```

### Bottleneck Analysis

```bash
# Identify most common bottleneck
bun run analyze:traces output/traces/$(date +%Y-%m-%d) | \
  grep -A 5 "Bottlenecks"
```

## Alerting

### Slow Request Alert

```bash
# Count slow requests (>25s) today
TODAY=$(date +%Y-%m-%d)
SLOW_COUNT=$(cat output/traces/$TODAY/*.json 2>/dev/null | \
  jq -r 'select(.performance.isSlowRequest == true)' | \
  jq -s 'length')

if [ "$SLOW_COUNT" -gt 0 ]; then
  echo "⚠️  Found $SLOW_COUNT slow requests today"
fi
```

### Delivery Failure Alert

```bash
# Check delivery failures in last hour
FAILURES=$(docker logs translator --since 1h 2>&1 | \
  grep translation_delivery_failed | \
  wc -l)

if [ "$FAILURES" -gt 0 ]; then
  echo "🚨 $FAILURES delivery failures in last hour"
fi
```

### Circuit Breaker Alert

```bash
# Check if circuit breaker is open
OPEN_CIRCUITS=$(docker logs translator --since 10m 2>&1 | \
  grep '"event":"circuit_breaker_opened"' | \
  wc -l)

if [ "$OPEN_CIRCUITS" -gt 0 ]; then
  echo "🔴 Circuit breaker opened! Check external service health."
fi
```

## Performance Trends

### Week-over-Week Comparison

```bash
# Compare this week vs last week
THIS_WEEK=$(date +%Y-%m-%d)
LAST_WEEK=$(date -d '7 days ago' +%Y-%m-%d)

echo "=== This Week ($THIS_WEEK) ==="
bun run analyze:traces output/traces/$THIS_WEEK

echo ""
echo "=== Last Week ($LAST_WEEK) ==="
bun run analyze:traces output/traces/$LAST_WEEK
```

### Monthly Report

```bash
# Aggregate all traces from current month
MONTH=$(date +%Y-%m)

echo "# Monthly Performance Report - $MONTH" > docs/analysis/monthly-report-$MONTH.md
echo "" >> docs/analysis/monthly-report-$MONTH.md

for day in output/traces/$MONTH-*; do
  if [ -d "$day" ]; then
    DAY_NAME=$(basename $day)
    echo "## $DAY_NAME" >> docs/analysis/monthly-report-$MONTH.md
    bun run analyze:traces $day >> docs/analysis/monthly-report-$MONTH.md
    echo "" >> docs/analysis/monthly-report-$MONTH.md
  fi
done

echo "Monthly report saved to: docs/analysis/monthly-report-$MONTH.md"
```

## Performance Optimization Monitoring

### Track Optimization Impact

After implementing optimizations, track the impact:

```bash
# Before optimization (baseline)
bun run analyze:traces output/traces/2026-04-01 > baseline.txt

# After optimization
bun run analyze:traces output/traces/2026-04-08 > optimized.txt

# Compare
echo "=== Performance Improvement ==="
BASELINE_P95=$(grep "P95:" baseline.txt | awk '{print $2}' | tr -d 'ms')
OPTIMIZED_P95=$(grep "P95:" optimized.txt | awk '{print $2}' | tr -d 'ms')
IMPROVEMENT=$(echo "scale=1; ($BASELINE_P95 - $OPTIMIZED_P95) / $BASELINE_P95 * 100" | bc)
echo "P95 latency improved by $IMPROVEMENT%"
```

### Prompt Version Comparison

```bash
# Compare baseline vs optimized prompt performance
grep '"promptVersion":"baseline"' output/traces/*/trace-*.json | wc -l
grep '"promptVersion":"optimized"' output/traces/*/trace-*.json | wc -l
```

### Circuit Breaker Health

```bash
# Check circuit breaker statistics
docker logs translator | grep circuit_breaker | \
  jq -s 'group_by(.circuitName) | map({circuit: .[0].circuitName, events: length})' | \
  jq -r '.[] | "\(.circuit): \(.events) events"'
```

## Dashboarding

### Key Metrics to Track

1. **Latency Percentiles**
   - P50 (median)
   - P95 (95th percentile)
   - P99 (99th percentile)

2. **Request Volume**
   - Requests per hour
   - Requests per provider

3. **Error Rates**
   - Delivery failures
   - LLM provider errors
   - Circuit breaker opens

4. **Resource Utilization**
   - Token usage per request
   - Async logging queue depth
   - HTTP connection pool usage

### Grafana Integration (Future)

Example Prometheus metrics that could be exported:

```
translation_request_duration_seconds{provider="gemini",stage="llmCall"}
translation_request_total{provider="gemini",status="success"}
translation_circuit_breaker_state{service="chatwork_api"} 0=closed, 1=open
translation_token_usage_total{provider="gemini",type="input"}
```

## Automated Monitoring Script

Create a monitoring cron job:

```bash
#!/bin/bash
# File: scripts/monitor.sh

TODAY=$(date +%Y-%m-%d)
TRACE_DIR="output/traces/$TODAY"

# Generate daily report
bun run report:daily

# Check for alerts
SLOW_REQUESTS=$(cat $TRACE_DIR/*.json 2>/dev/null | \
  jq -r 'select(.performance.isSlowRequest == true)' | \
  jq -s 'length')

if [ "$SLOW_REQUESTS" -gt 10 ]; then
  echo "⚠️  Alert: $SLOW_REQUESTS slow requests today (>10% threshold)"
  # Send notification (e.g., via Slack webhook, email, etc.)
fi

FAILURES=$(docker logs translator --since 24h 2>&1 | \
  grep translation_delivery_failed | \
  wc -l)

if [ "$FAILURES" -gt 5 ]; then
  echo "🚨 Alert: $FAILURES delivery failures in last 24h"
  # Send notification
fi
```

Schedule with cron:
```bash
# Run monitoring every hour
0 * * * * /path/to/scripts/monitor.sh >> /var/log/chatwork-monitor.log 2>&1

# Generate daily report at 11pm
0 23 * * * cd /path/to/bot && bun run report:daily >> /var/log/chatwork-reports.log 2>&1
```

## Incident Response

### High Latency Incident

1. **Check real-time logs:**
   ```bash
   docker logs translator -f | grep translation_trace
   ```

2. **Identify bottleneck:**
   ```bash
   bun run analyze:traces output/traces/$(date +%Y-%m-%d) | grep -A 5 "Bottlenecks"
   ```

3. **If LLM is bottleneck:**
   - Check provider status page
   - Review recent deployments (prompt changes)
   - Consider switching to faster model temporarily

4. **If delivery is bottleneck:**
   - Check Chatwork API status
   - Verify circuit breaker isn't open
   - Check network connectivity

### High Error Rate Incident

1. **Check error logs:**
   ```bash
   docker logs translator --since 1h | grep '"level":"error"'
   ```

2. **Check circuit breaker status:**
   ```bash
   docker logs translator | grep circuit_breaker | tail -20
   ```

3. **If circuit breaker is open:**
   - Wait for automatic recovery (30s for Chatwork, 60s for LLM)
   - Check external service health
   - Consider manual intervention if service is degraded

## Related Documentation

- [Analyzing Traces Guide](./analyzing-traces.md)
- [Translator Observability](./translator-observability.md)
- [Performance Optimization Plan](../plans/2026-04-05-performance-optimization.md)
- [Environment Variables](../../ai_rules/security.md)
