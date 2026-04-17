import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dir, '..')

function getComposeServiceBlock(composeContent: string, serviceName: string): string {
  const lines = composeContent.split('\n')
  const servicesIndex = lines.indexOf('services:')
  if (servicesIndex === -1) {
    throw new Error('services section not found in docker-compose.dev.yml')
  }

  const serviceHeader = `  ${serviceName}:`
  const serviceStart = lines.findIndex(
    (line, index) => index > servicesIndex && line === serviceHeader,
  )
  if (serviceStart === -1) {
    throw new Error(`service ${serviceName} not found in docker-compose.dev.yml`)
  }

  const serviceLines = [lines[serviceStart] ?? '']
  for (let index = serviceStart + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (/^[a-zA-Z0-9_-]+:\s*$/.test(line)) {
      break
    }
    if (/^  [^ #][^:]*:\s*$/.test(line)) {
      break
    }
    serviceLines.push(line)
  }

  return serviceLines.join('\n')
}

describe('scripts/dev.sh orchestration', () => {
  it('keeps TTY enabled for Bun services in docker-compose.dev.yml', () => {
    const composeContent = readFileSync(join(repoRoot, 'docker-compose.dev.yml'), 'utf8')

    for (const serviceName of [
      'translator',
      'webhook-logger',
      'dataset-runner',
      'kagi-translator',
    ]) {
      const serviceBlock = getComposeServiceBlock(composeContent, serviceName)
      expect(serviceBlock).toContain('tty: true')
    }
  })

  it('wires translator to the kagi sidecar URL and free payload limits in docker-compose.dev.yml', () => {
    const composeContent = readFileSync(join(repoRoot, 'docker-compose.dev.yml'), 'utf8')
    const translatorBlock = getComposeServiceBlock(composeContent, 'translator')

    expect(translatorBlock).toContain('KAGI_TRANSLATOR_URL=http://kagi-translator:3002')
    expect(translatorBlock).toContain(
      'KAGI_MAX_ENCODED_PAYLOAD_CHARS=${KAGI_MAX_ENCODED_PAYLOAD_CHARS:-12000}',
    )
    expect(translatorBlock).toContain('KAGI_MAX_SEGMENT_COUNT=${KAGI_MAX_SEGMENT_COUNT:-50}')
  })

  it('configures the kagi sidecar guardrails in docker-compose.dev.yml', () => {
    const composeContent = readFileSync(join(repoRoot, 'docker-compose.dev.yml'), 'utf8')
    const kagiBlock = getComposeServiceBlock(composeContent, 'kagi-translator')

    expect(kagiBlock).toContain('bun install && bun --hot packages/kagi-sidecar/src/index.ts')
    expect(kagiBlock).not.toContain('- node_modules:/app/node_modules')
    expect(kagiBlock).toContain('- .:/app')
    expect(kagiBlock).toContain('- kagi_node_modules:/app/node_modules')
    expect(kagiBlock).toContain('- kagi_bun_cache:/root/.bun/install/cache')
    expect(kagiBlock).toContain('KAGI_PORT=3002')
    expect(kagiBlock).toContain('KAGI_MIN_INTERVAL_MS=${KAGI_MIN_INTERVAL_MS:-1500}')
    expect(kagiBlock).toContain('KAGI_MAX_RETRIES=${KAGI_MAX_RETRIES:-2}')
    expect(kagiBlock).toContain('KAGI_RETRY_BASE_MS=${KAGI_RETRY_BASE_MS:-1000}')
    expect(kagiBlock).toContain('KAGI_REQUEST_TIMEOUT_MS=${KAGI_REQUEST_TIMEOUT_MS:-30000}')
    expect(kagiBlock).toContain('KAGI_MAX_QUEUE_DEPTH=${KAGI_MAX_QUEUE_DEPTH:-10}')
    expect(kagiBlock).toContain('KAGI_MAX_QUEUE_WAIT_MS=${KAGI_MAX_QUEUE_WAIT_MS:-120000}')
    expect(kagiBlock).toContain('HUSKY=0')
    expect(kagiBlock).toContain('BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache')
    expect(kagiBlock).toContain("fetch('http://localhost:3002/health')")
  })

  it('serializes shared node_modules installs through translator only in docker-compose.dev.yml', () => {
    const composeContent = readFileSync(join(repoRoot, 'docker-compose.dev.yml'), 'utf8')
    const translatorBlock = getComposeServiceBlock(composeContent, 'translator')
    const dashboardBlock = getComposeServiceBlock(composeContent, 'dashboard')
    const webhookLoggerBlock = getComposeServiceBlock(composeContent, 'webhook-logger')
    const datasetRunnerBlock = getComposeServiceBlock(composeContent, 'dataset-runner')

    expect(translatorBlock).toContain('bun install && bun --hot packages/translator/src/index.ts')

    for (const serviceBlock of [dashboardBlock, webhookLoggerBlock, datasetRunnerBlock]) {
      expect(serviceBlock).not.toContain('bun install &&')
      expect(serviceBlock).toContain('- node_modules:/app/node_modules')
    }

    expect(dashboardBlock).toContain('depends_on:')
    expect(dashboardBlock).toContain('translator:')
    expect(dashboardBlock).toContain('condition: service_healthy')
  })

  it('ships a dedicated production Dockerfile and compose service for kagi translation', () => {
    const dockerfileContent = readFileSync(join(repoRoot, 'Dockerfile.kagi'), 'utf8')
    const composeContent = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8')
    const translatorBlock = getComposeServiceBlock(composeContent, 'translator')
    const kagiBlock = getComposeServiceBlock(composeContent, 'kagi-translator')

    expect(dockerfileContent).toContain('packages/kagi-sidecar/package.json')
    expect(dockerfileContent).toContain('packages/provider-kagi/package.json')
    expect(dockerfileContent).toContain('packages/translator/package.json')
    expect(dockerfileContent).toContain('RUN bun install --frozen-lockfile')
    expect(dockerfileContent).toContain('fonts-kacst-one')
    expect(dockerfileContent).not.toContain('fonts-kacst \\\n')
    expect(dockerfileContent).toContain('packages/kagi-sidecar/src')
    expect(dockerfileContent).toContain(
      'CMD ["sh", "packages/kagi-sidecar/scripts/start-with-xvfb.sh", "bun packages/kagi-sidecar/src/index.ts"]',
    )
    expect(kagiBlock).toContain('dockerfile: Dockerfile.kagi')
    expect(kagiBlock).toContain('KAGI_PORT: 3002')
    expect(translatorBlock).toContain('KAGI_TRANSLATOR_URL: http://kagi-translator:3002')
  })

  it('keeps Docker workspace manifest copies aligned with the monorepo for frozen installs', () => {
    const translatorDockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8')
    const loggerDockerfile = readFileSync(join(repoRoot, 'Dockerfile.logger'), 'utf8')
    const kagiDockerfile = readFileSync(join(repoRoot, 'Dockerfile.kagi'), 'utf8')

    for (const dockerfileContent of [translatorDockerfile, loggerDockerfile, kagiDockerfile]) {
      expect(dockerfileContent).toContain('packages/provider-kagi/package.json')
      expect(dockerfileContent).toContain('packages/kagi-sidecar/package.json')
    }

    expect(translatorDockerfile).toContain(
      'COPY packages/provider-kagi/src packages/provider-kagi/src',
    )
    expect(kagiDockerfile).toContain('COPY packages/provider-kagi/src packages/provider-kagi/src')
  })

  it('documents translator and sidecar kagi env vars in .env.example', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8')

    expect(envExample).toContain('KAGI_TRANSLATOR_URL=http://kagi-translator:3002')
    expect(envExample).toContain('KAGI_MAX_ENCODED_PAYLOAD_CHARS=12000')
    expect(envExample).toContain('KAGI_MAX_SEGMENT_COUNT=50')
    expect(envExample).toContain('KAGI_MIN_INTERVAL_MS=1500')
    expect(envExample).toContain('KAGI_MAX_RETRIES=2')
    expect(envExample).toContain('KAGI_RETRY_BASE_MS=1000')
    expect(envExample).toContain('KAGI_REQUEST_TIMEOUT_MS=120000')
    expect(envExample).toContain('KAGI_MAX_QUEUE_DEPTH=10')
    expect(envExample).toContain('KAGI_MAX_QUEUE_WAIT_MS=120000')
  })

  it('wires webhook-logger to the translator service URL only in docker-compose.dev.yml', () => {
    const composeContent = readFileSync(join(repoRoot, 'docker-compose.dev.yml'), 'utf8')
    const webhookLoggerBlock = getComposeServiceBlock(composeContent, 'webhook-logger')

    expect(webhookLoggerBlock).toContain('TRANSLATOR_URL=http://translator:3000')
    expect(webhookLoggerBlock).not.toContain('TRANSLATOR_INTERNAL_URL=http://translator:3000')
  })

  it('keeps the zrok container alive after share exits so dev stays up without a tunnel', () => {
    const composeContent = readFileSync(join(repoRoot, 'docker-compose.dev.yml'), 'utf8')
    const zrokBlock = getComposeServiceBlock(composeContent, 'zrok')

    expect(zrokBlock).toContain('tail -f /dev/null')
    expect(zrokBlock).toContain('local dev will continue without a public tunnel')
  })

  it('uses the stable zrok v1 image for the reserved-share dev tunnel', () => {
    const composeContent = readFileSync(join(repoRoot, 'docker-compose.dev.yml'), 'utf8')
    const zrokBlock = getComposeServiceBlock(composeContent, 'zrok')

    expect(zrokBlock).toContain('image: openziti/zrok:1.1.11')
    expect(zrokBlock).toContain('dns:')
    expect(zrokBlock).toContain('- 1.1.1.1')
    expect(zrokBlock).toContain('- 8.8.8.8')
    expect(zrokBlock).toContain('zrok enable "${ZROK_ENABLE_TOKEN}" --headless')
  })

  it('normalizes the zrok unique name, persists the reserved share token, and shares by token', () => {
    const composeContent = readFileSync(join(repoRoot, 'docker-compose.dev.yml'), 'utf8')
    const zrokBlock = getComposeServiceBlock(composeContent, 'zrok')

    expect(zrokBlock).toContain("tr '[:upper:]' '[:lower:]'")
    expect(zrokBlock).toContain("tr -cd '[:alnum:]'")
    expect(zrokBlock).toContain('reserved_file=/home/ziggy/.zrok/reserved.json')
    expect(zrokBlock).toContain('zrok reserve public $$backend_target --unique-name')
    expect(zrokBlock).toContain('backend_target="http://gateway:80"')
    expect(zrokBlock).toContain('--json-output 2>&1')
    expect(zrokBlock).toContain('printf \'%s\\n\' "$$reserve_output" > "$$reserved_file"')
    expect(zrokBlock).toContain('extract_share_token() {')
    expect(zrokBlock).toContain('share_token=$$(extract_share_token "$$reserved_file")')
    expect(zrokBlock).toContain('zrok share reserved "$$share_token" --headless')
    expect(zrokBlock).not.toContain('zrok share reserved "${ZROK_UNIQUE_NAME}" --headless')
    expect(zrokBlock).not.toContain('zrok reserve public http://webhook-logger:3001')
  })

  it('removes the v2-only retry and name-selection flow from the zrok container', () => {
    const composeContent = readFileSync(join(repoRoot, 'docker-compose.dev.yml'), 'utf8')
    const zrokBlock = getComposeServiceBlock(composeContent, 'zrok')

    expect(zrokBlock).not.toContain('zrok create name')
    expect(zrokBlock).not.toContain('max_attempts=')
    expect(zrokBlock).not.toContain('retrying in')
    expect(zrokBlock).not.toContain('share public http://webhook-logger:3001 --headless -n public:')
  })
})
