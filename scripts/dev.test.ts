import { afterEach, describe, expect, it } from 'bun:test'
import {
  chmodSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dir, '..')
const concurrentlyBin = join(repoRoot, 'node_modules', '.bin', 'concurrently')
const nodeBin = Bun.which('node') ?? 'node'
const tempDirs: string[] = []

interface TestWorkspaceOptions {
  provider: 'cursor' | 'gemini'
  includeDatasetScript?: boolean
  includeSampleFile?: boolean
  proxyMode?: 'steady' | 'fail-fast'
  dockerMode?: 'success' | 'hang'
  interruptAfterSeconds?: string
}

interface TestWorkspace {
  binDir: string
  eventLogPath: string
  rootDir: string
}

interface ScriptRunResult {
  events: string
  exitCode: number
  stderr: string
  stdout: string
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true })
  }
})

function writeExecutable(filePath: string, content: string): void {
  writeFileSync(filePath, content)
  chmodSync(filePath, 0o755)
}

function createTestWorkspace(options: TestWorkspaceOptions): TestWorkspace {
  const rootDir = mkdtempSync(join(tmpdir(), 'dev-script-test-'))
  tempDirs.push(rootDir)

  const scriptsDir = join(rootDir, 'scripts')
  const binDir = join(rootDir, 'bin')
  const eventLogPath = join(rootDir, 'events.log')
  const proxyCliDir = join(rootDir, 'node_modules', 'cursor-api-proxy', 'dist')

  mkdirSync(scriptsDir, { recursive: true })
  mkdirSync(binDir, { recursive: true })
  mkdirSync(proxyCliDir, { recursive: true })
  writeFileSync(eventLogPath, '')
  writeFileSync(join(proxyCliDir, 'cli.js'), '// test stub for realpath\n')

  cpSync(join(repoRoot, 'scripts', 'dev.sh'), join(scriptsDir, 'dev.sh'))
  if (options.includeDatasetScript) {
    cpSync(join(repoRoot, 'scripts', 'dev-dataset.sh'), join(scriptsDir, 'dev-dataset.sh'))
  }

  if (options.includeSampleFile) {
    mkdirSync(join(rootDir, 'input', 'samples'), { recursive: true })
    writeFileSync(
      join(rootDir, 'input', 'samples', '001-test.jsonl'),
      '{"id":"item-001","message":"hello"}\n',
    )
  }

  writeFileSync(
    join(rootDir, '.env'),
    `AI_PROVIDER=${options.provider}\nCURSOR_API_URL=http://localhost:8765/v1\n`,
  )

  const dashboardDistDir = join(rootDir, 'packages', 'dashboard', 'dist')
  mkdirSync(dashboardDistDir, { recursive: true })
  writeFileSync(join(dashboardDistDir, 'index.html'), '<!-- test stub -->\n')

  writeExecutable(
    join(binDir, 'bunx'),
    `#!/bin/sh
if [ "$1" != "concurrently" ]; then
  echo "unexpected bunx args: $*" >&2
  exit 2
fi

shift

if [ -n "$TEST_INTERRUPT_AFTER_SECONDS" ]; then
  target_parent="$PPID"
  target_self="$$"
  (
    sleep "$TEST_INTERRUPT_AFTER_SECONDS"
    kill -INT "$target_parent"
    kill -INT "$target_self"
  ) &
fi

exec "${nodeBin}" "${concurrentlyBin}" "$@"
`,
  )

  writeExecutable(
    join(binDir, 'bun'),
    `#!/bin/sh
case "$1 $2" in
  "run build:dashboard") exit 0 ;;
  *) echo "unexpected bun args: $*" >&2; exit 2 ;;
esac
`,
  )

  writeExecutable(
    join(binDir, 'node'),
    `#!/bin/sh
case "$1" in
  */node_modules/cursor-api-proxy/dist/cli.js)
  echo "proxy:start" >> "$TEST_EVENT_LOG"

  if [ "$TEST_PROXY_MODE" = "fail-fast" ]; then
    attempts=0
    while [ "$attempts" -lt 20 ]; do
      if grep -q 'docker:-f docker-compose.dev.yml up ' "$TEST_EVENT_LOG" 2>/dev/null; then
        break
      fi
      sleep 0.1
      attempts=$((attempts + 1))
    done

    sleep 0.2
    echo "proxy:exit-1" >> "$TEST_EVENT_LOG"
    exit 1
  fi

  trap 'echo "proxy:term" >> "$TEST_EVENT_LOG"; trap - TERM; kill -s TERM "$$"' TERM
  trap 'echo "proxy:int" >> "$TEST_EVENT_LOG"; trap - INT; kill -s INT "$$"' INT

  while :; do
    sleep 1
  done
  ;;
esac

echo "unexpected node args: $*" >&2
exit 2
`,
  )

  writeExecutable(
    join(binDir, 'docker'),
    `#!/bin/sh
case "$1" in
  compose)
    shift
    echo "docker:$*" >> "$TEST_EVENT_LOG"

    case " $* " in
      *" up "*)
        if [ "$TEST_DOCKER_MODE" = "hang" ]; then
          trap 'echo "docker:up-term" >> "$TEST_EVENT_LOG"; trap - TERM; kill -s TERM "$$"' TERM
          trap 'echo "docker:up-int" >> "$TEST_EVENT_LOG"; trap - INT; kill -s INT "$$"' INT

          while :; do
            sleep 1
          done
        fi

        sleep 0.2
        echo "docker:up-exit-0" >> "$TEST_EVENT_LOG"
        exit 0
        ;;
      *" down "*)
        echo "docker:down" >> "$TEST_EVENT_LOG"
        exit 0
        ;;
      *)
        echo "unexpected docker compose args: $*" >&2
        exit 2
        ;;
    esac
    ;;
  *)
    echo "unexpected docker args: $*" >&2
    exit 2
    ;;
esac
`,
  )

  writeExecutable(
    join(binDir, 'lsof'),
    `#!/bin/sh
if [ -n "$TEST_LSOF_OUTPUT" ]; then
  printf '%s\n' "$TEST_LSOF_OUTPUT"
fi

exit 0
`,
  )

  writeExecutable(
    join(binDir, 'curl'),
    `#!/bin/sh
if [ "$TEST_CURL_MODE" = "success" ]; then
  exit 0
fi

exit 22
`,
  )

  return {
    binDir,
    eventLogPath,
    rootDir,
  }
}

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

async function runScript(
  workspace: TestWorkspace,
  scriptRelativePath: string,
  scriptArgs: string[] = [],
  extraEnv: Record<string, string> = {},
): Promise<ScriptRunResult> {
  const proc = Bun.spawn(['sh', scriptRelativePath, ...scriptArgs], {
    cwd: workspace.rootDir,
    env: {
      ...process.env,
      AI_PROVIDER: extraEnv['AI_PROVIDER'] ?? 'cursor',
      CURSOR_API_URL: 'http://localhost:8765/v1',
      PATH: `${workspace.binDir}:${process.env['PATH'] ?? ''}`,
      TEST_DOCKER_MODE: extraEnv['TEST_DOCKER_MODE'] ?? 'success',
      TEST_EVENT_LOG: workspace.eventLogPath,
      TEST_INTERRUPT_AFTER_SECONDS: extraEnv['TEST_INTERRUPT_AFTER_SECONDS'] ?? '',
      TEST_CURL_MODE: extraEnv['TEST_CURL_MODE'] ?? '',
      TEST_LSOF_OUTPUT: extraEnv['TEST_LSOF_OUTPUT'] ?? '',
      TEST_PROXY_MODE: extraEnv['TEST_PROXY_MODE'] ?? 'steady',
    },
    stderr: 'pipe',
    stdout: 'pipe',
  })

  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()

  return {
    events: readFileSync(workspace.eventLogPath, 'utf8'),
    exitCode,
    stderr,
    stdout,
  }
}

describe('scripts/dev.sh orchestration', () => {
  it('returns 0 in cursor mode when docker exits cleanly and proxy is SIGTERMd by kill-others', async () => {
    const workspace = createTestWorkspace({ provider: 'cursor' })

    const result = await runScript(workspace, 'scripts/dev.sh', ['up'])
    const combinedOutput = `${result.stdout}${result.stderr}`

    expect(result.exitCode).toBe(0)
    expect(result.events).toContain('proxy:start')
    expect(result.events).toContain('docker:up-exit-0')
    expect(result.events).toContain('proxy:term')
    expect(result.events).toContain('docker:down')
    expect(combinedOutput).toContain('exited with code SIGTERM')
    expect(combinedOutput).not.toContain('error: script "cursor-proxy"')
  })

  it('returns non-zero in cursor mode when proxy exits unexpectedly first', async () => {
    const workspace = createTestWorkspace({
      dockerMode: 'hang',
      provider: 'cursor',
      proxyMode: 'fail-fast',
    })

    const result = await runScript(workspace, 'scripts/dev.sh', ['up'], {
      TEST_DOCKER_MODE: 'hang',
      TEST_PROXY_MODE: 'fail-fast',
    })

    expect(result.exitCode).toBe(1)
    expect(result.events).toContain('proxy:exit-1')
    expect(result.events).toContain('docker:up-term')
    expect(result.events).toContain('docker:down')
  })

  it('keeps docker-only mode unchanged for non-cursor providers', async () => {
    const workspace = createTestWorkspace({ provider: 'gemini' })

    const result = await runScript(workspace, 'scripts/dev.sh', ['up'], {
      AI_PROVIDER: 'gemini',
    })

    expect(result.exitCode).toBe(0)
    expect(result.events).toContain('docker:up-exit-0')
    expect(result.events).toContain('docker:down')
    expect(result.events).not.toContain('proxy:start')
  })

  it('reuses a healthy existing cursor proxy without falling through to local proxy startup', async () => {
    const workspace = createTestWorkspace({ provider: 'cursor' })

    const result = await runScript(workspace, 'scripts/dev.sh', ['up'], {
      TEST_CURL_MODE: 'success',
      TEST_LSOF_OUTPUT: '4242',
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('reusing healthy cursor-proxy')
    expect(result.events).toContain('docker:up-exit-0')
    expect(result.events).toContain('docker:down')
    expect(result.events).not.toContain('proxy:start')
  })

  it('propagates the clean cursor-mode exit through dev:dataset', async () => {
    const workspace = createTestWorkspace({
      includeDatasetScript: true,
      includeSampleFile: true,
      provider: 'cursor',
    })

    const result = await runScript(workspace, 'scripts/dev-dataset.sh')
    const combinedOutput = `${result.stdout}${result.stderr}`

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('[dataset] starting dev stack with DATASET_AUTORUN=true ...')
    expect(result.events).toContain('docker:up-exit-0')
    expect(result.events).toContain('proxy:term')
    expect(result.events).toContain('docker:down')
    expect(combinedOutput).not.toContain('error: script "cursor-proxy"')
  })

  it('cleans up on SIGINT without turning proxy SIGINT into a false exit-code 1', async () => {
    const workspace = createTestWorkspace({
      dockerMode: 'hang',
      provider: 'cursor',
    })

    const result = await runScript(workspace, 'scripts/dev.sh', ['up'], {
      TEST_DOCKER_MODE: 'hang',
      TEST_INTERRUPT_AFTER_SECONDS: '0.2',
    })

    expect(result.exitCode).not.toBe(1)
    expect(result.events).toContain('docker:down')
    expect(result.stderr).toContain('[dev] shutting down stack...')
  })

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
    expect(kagiBlock).toContain('KAGI_MAX_QUEUE_WAIT_MS=${KAGI_MAX_QUEUE_WAIT_MS:-15000}')
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
    expect(dockerfileContent).toContain('CMD ["bun", "packages/kagi-sidecar/src/index.ts"]')
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
    expect(kagiDockerfile).not.toContain(
      'COPY packages/provider-kagi/src packages/provider-kagi/src',
    )
  })

  it('documents translator and sidecar kagi env vars in .env.example', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8')

    expect(envExample).toContain('KAGI_TRANSLATOR_URL=http://kagi-translator:3002')
    expect(envExample).toContain('KAGI_MAX_ENCODED_PAYLOAD_CHARS=12000')
    expect(envExample).toContain('KAGI_MAX_SEGMENT_COUNT=50')
    expect(envExample).toContain('KAGI_MIN_INTERVAL_MS=1500')
    expect(envExample).toContain('KAGI_MAX_RETRIES=2')
    expect(envExample).toContain('KAGI_RETRY_BASE_MS=1000')
    expect(envExample).toContain('KAGI_REQUEST_TIMEOUT_MS=30000')
    expect(envExample).toContain('KAGI_MAX_QUEUE_DEPTH=10')
    expect(envExample).toContain('KAGI_MAX_QUEUE_WAIT_MS=15000')
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
