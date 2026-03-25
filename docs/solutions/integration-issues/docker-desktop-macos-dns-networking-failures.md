---
title: 'Docker Desktop macOS DNS Failures — Go Resolver Hang and IPv6 AAAA Timeout'
date: 2026-03-25
category: integration-issues
tags:
  - docker-desktop
  - macos
  - dns
  - ipv6
  - go-dns-resolver
  - bun-runtime
  - zrok
  - cloudflare
  - docker-compose
severity: high
symptoms:
  - 'context deadline exceeded (Client.Timeout exceeded while awaiting headers) on zrok share reserved'
  - 'Cannot connect to API: Unable to connect. Is the computer able to access the url? (OpenAI via Bun)'
  - 'wget: bad address (BusyBox on Alpine)'
root_causes:
  - "Go's pure-Go DNS resolver hangs inside Docker Desktop macOS"
  - 'IPv6 AAAA lookups for Cloudflare-fronted APIs time out in Docker Desktop macOS'
components:
  - docker-compose.dev.yml
  - zrok container (openziti/zrok:1.1.11, Go 1.24.7)
  - translator/webhook-logger/dataset-runner (oven/bun:1.3-alpine)
environment:
  - Docker Desktop on macOS (Darwin 24.6.0)
  - oven/bun:1.3-alpine (Alpine Linux, musl libc)
  - openziti/zrok:1.1.11 (RHEL 9.6, Go 1.24.7)
---

# Docker Desktop macOS DNS Failures

## Problem Statement

On 2026-03-24, the local dev stack stopped working. Two distinct DNS failures surfaced:

1. **zrok tunnel**: `zrok share reserved` hung with `context deadline exceeded` authenticating with the OpenZiti controller. Go's built-in DNS resolver could not complete hostname resolution inside Docker's virtual network.

2. **Bun/OpenAI**: translator failed to connect to `api.openai.com` and other Cloudflare-fronted APIs. IPv6 AAAA DNS lookups timed out, causing Bun's fetch to fail.

Both share the same root theme: **Docker Desktop macOS introduces DNS resolution anomalies** that affect language runtimes (Go, Bun/musl) while standard tools (`nslookup`, `curl`) work correctly.

## Investigation Steps

### zrok: Narrowing Down

1. Initial hypothesis (wrong): zrok v2 migration retired v1 infrastructure. Disproved — `latest` image is still v1.1.11.
2. Tested controller from host: DNS resolves, TLS handshake completes, mTLS auth returns 200.
3. Tested from Docker container with `curl` + extracted client certs: also 200.
4. **zrok Go binary hangs** at the same step where curl succeeds.
5. `--add-host <controller>:<ip>` bypasses DNS → **zrok connects immediately**.

### Bun: Narrowing Down

1. `fetch('https://google.com')` → 200. `fetch('https://api.openai.com/...')` → fails.
2. Direct IP fetch with Host header → 401 (connection works, no API key).
3. `nslookup -type=AAAA api.openai.com` → **times out**. `-type=A` → works.
4. `--sysctl net.ipv6.conf.all.disable_ipv6=1` → **OpenAI returns 401**.

## Root Cause

### Go DNS Resolver Hang

Go's pure-Go DNS resolver (Go 1.24.7) hangs when resolving certain hostnames inside Docker Desktop macOS. The OpenZiti controller hostname resolves correctly via `getent hosts` and `nslookup`, but Go's resolver times out. Edge router hostnames (`*.production.netfoundry.io`) resolve fine after the initial connection, suggesting the issue is specific to Go's `net/http` DNS resolution path.

### Bun IPv6 AAAA Timeout

Bun attempts both A and AAAA DNS lookups. For Cloudflare-fronted domains, AAAA queries time out inside Docker Desktop macOS. The AAAA timeout blocks the entire resolution, causing fetch to fail. Google.com AAAA resolves fine (different DNS infrastructure), explaining the inconsistent behavior.

## Solution

### Fix 1: zrok — DNS Pre-Resolution to /etc/hosts

Run container as root to allow `/etc/hosts` write:

```yaml
zrok:
  image: openziti/zrok:1.1.11
  user: '0:0'
  environment:
    - HOME=/home/ziggy # preserve config path
```

In entrypoint, after `zrok enable`:

```sh
_zt_identity=/home/ziggy/.zrok/identities/environment.json
if [ -f "$$_zt_identity" ]; then
  _zt_host=$$(sed -n 's/.*"ztAPI":"https:\/\/\([^:/]*\).*/\1/p' "$$_zt_identity")
  if [ -n "$$_zt_host" ]; then
    _zt_ip=$$(getent hosts "$$_zt_host" 2>/dev/null | awk '{print $$1}')
    if [ -n "$$_zt_ip" ]; then
      printf '%s %s\n' "$$_zt_ip" "$$_zt_host" >> /etc/hosts
      echo "[zrok] pre-resolved $$_zt_host -> $$_zt_ip"
    fi
  fi
fi
```

### Fix 2: Bun Services — Disable IPv6

Applied to all Bun-based services (translator, webhook-logger, dataset-runner):

```yaml
dns:
  - 1.1.1.1
  - 8.8.8.8
sysctls:
  - net.ipv6.conf.all.disable_ipv6=1
```

### Fix 3: Orphaned zrok Environment Cleanup

When `.docker/zrok/` is deleted without `zrok disable`, environments become orphaned server-side:

```bash
ZROK_TOKEN=$(python3 -c "import json; print(json.load(open('.docker/zrok/environment.json'))['zrok_token'])")
# List all environments
docker run --rm -v ./.docker/zrok:/home/ziggy/.zrok --entrypoint "" \
  -e HOME=/home/ziggy openziti/zrok:1.1.11 zrok overview
# Disable orphaned ones
curl -s -X POST "https://api-v1.zrok.io/api/v1/disable" \
  -H "Content-Type: application/zrok.v1+json" \
  -H "x-token: $ZROK_TOKEN" \
  -d '{"identity":"<envZId>"}'
# Then reset local state
rm -rf .docker/zrok/ && bun run dev
```

## What Didn't Work

| Approach                              | Why                                                |
| ------------------------------------- | -------------------------------------------------- |
| Upgrading zrok 1.1.10 → 1.1.11        | Same Go runtime, same DNS issue                    |
| `GODEBUG=tlsmlkem=0`                  | Not TLS-related                                    |
| `GODEBUG=netdns=cgo` alone            | CGO resolver doesn't fix it without /etc/hosts     |
| Docker network MTU=1400               | Not MTU fragmentation                              |
| `dns:` config alone (without sysctls) | IPv6 AAAA still times out through Docker DNS proxy |
| Assuming zrok v2 migration            | `latest` is still v1.1.11                          |

## Detection Checklist

| Symptom                                                               | Likely Cause                             |
| --------------------------------------------------------------------- | ---------------------------------------- |
| App fails to connect but `curl` to same URL works from same container | Runtime DNS resolver mismatch            |
| `google.com` works but `api.openai.com` fails                         | IPv6 AAAA timeout (Cloudflare endpoints) |
| `nslookup -type=AAAA <domain>` times out                              | Confirmed IPv6 DNS issue                 |
| Go binary hangs on HTTP but curl with same certs works                | Go pure-Go DNS resolver hang             |
| `--add-host` fixes it                                                 | DNS resolution is the bottleneck         |
| Only on macOS, works on Linux CI                                      | Docker Desktop virtual networking        |

## Prevention

When adding new Docker Compose services that call external APIs:

```yaml
# Standard networking config for macOS Docker Desktop
dns:
  - 1.1.1.1
  - 8.8.8.8
sysctls:
  - net.ipv6.conf.all.disable_ipv6=1
```

For Go-based services with mTLS: pin critical hostnames to `/etc/hosts` in entrypoint.

## Related

- [docs/operations/zrok.md](../operations/zrok.md) — zrok setup and troubleshooting
- [docker-compose.dev.yml](../../../docker-compose.dev.yml) — file containing all fixes
