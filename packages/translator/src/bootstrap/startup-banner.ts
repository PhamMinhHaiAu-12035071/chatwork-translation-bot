import { listProviderPlugins } from '@chatwork-bot/core'
import {
  DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS,
  type PipelineTimeoutSource,
  formatTimeoutSeconds,
} from '~/services/pipeline-timeout'

interface BannerConfig {
  port: number
  nodeEnv: string
  effectiveTimeoutMs: number
  timeoutSource: PipelineTimeoutSource
  roomCount: number
}

export function logStartupBanner(config: BannerConfig): void {
  const plugins = listProviderPlugins()

  const rows = plugins.map((p) => {
    const provider = p.manifest.id
    const models = p.manifest.supportedModels.join(', ')
    const timeout = formatTimeoutSeconds(
      p.manifest.timeoutMs ?? DEFAULT_TRANSLATOR_PIPELINE_TIMEOUT_MS,
    )
    return { provider, models, default: p.manifest.defaultModel, timeout }
  })

  const col = {
    provider: Math.max(8, ...rows.map((r) => r.provider.length)),
    models: Math.max(16, ...rows.map((r) => Math.min(r.models.length, 40))),
    default: Math.max(7, ...rows.map((r) => r.default.length)),
    timeout: Math.max(7, ...rows.map((r) => r.timeout.length)),
  }

  const pad = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + '…' : s.padEnd(w))
  const sep = `├${'─'.repeat(col.provider + 2)}┼${'─'.repeat(col.models + 2)}┼${'─'.repeat(col.default + 2)}┼${'─'.repeat(col.timeout + 2)}┤`
  const top = `┌${'─'.repeat(col.provider + 2)}┬${'─'.repeat(col.models + 2)}┬${'─'.repeat(col.default + 2)}┬${'─'.repeat(col.timeout + 2)}┐`
  const bot = `└${'─'.repeat(col.provider + 2)}┴${'─'.repeat(col.models + 2)}┴${'─'.repeat(col.default + 2)}┴${'─'.repeat(col.timeout + 2)}┘`
  const row = (a: string, b: string, c: string, d: string) =>
    `│ ${pad(a, col.provider)} │ ${pad(b, col.models)} │ ${pad(c, col.default)} │ ${pad(d, col.timeout)} │`

  console.log(`[translator] ${top}`)
  console.log(`[translator] ${row('Provider', 'Supported Models', 'Default', 'Timeout')}`)
  console.log(`[translator] ${sep}`)
  for (const r of rows) {
    console.log(`[translator] ${row(r.provider, r.models, r.default, r.timeout)}`)
  }
  console.log(`[translator] ${bot}`)
  console.log(
    `[translator] * AI provider/model/style configured per-room (${config.roomCount.toString()} rooms loaded)`,
  )
  console.log(
    `[translator] * effective pipeline timeout = ${formatTimeoutSeconds(config.effectiveTimeoutMs)} (source=${config.timeoutSource})`,
  )
}
