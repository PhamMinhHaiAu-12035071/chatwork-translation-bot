import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TranslationTrace } from '~/types/trace'
import { env } from '~/env'

/**
 * Persist translation trace to daily folder.
 *
 * Output structure:
 *   output/traces/YYYY-MM-DD/trace-{traceId}.json
 *
 * Environment variables:
 *   - OUTPUT_BASE_DIR: Base directory for all output (default: './output')
 *   - TRACE_OUTPUT_ENABLED: Enable trace persistence (default: true)
 */
export async function persistTrace(trace: TranslationTrace): Promise<void> {
  if (!env.TRACE_OUTPUT_ENABLED) return

  try {
    // Create daily folder: output/traces/YYYY-MM-DD/
    const date = new Date().toISOString().split('T')[0] ?? ''
    const outputBase: string = env.OUTPUT_BASE_DIR || './output'
    const traceDir = join(outputBase, 'traces', date)

    await mkdir(traceDir, { recursive: true })

    // Write trace file: trace-{traceId}.json
    const filename = `trace-${trace.traceId}.json`
    const filepath = join(traceDir, filename)

    await writeFile(filepath, JSON.stringify(trace, null, 2))
  } catch (error) {
    // Silent fail - don't crash the main flow for trace persistence errors
    console.error('[trace-persistence] Failed to persist trace:', error)
  }
}
