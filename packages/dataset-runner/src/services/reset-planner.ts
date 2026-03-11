import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { readDatasetState, writeDatasetState } from '~/services/state-store'

export interface StartupResetConfig {
  inputDir: string
  outputDir: string
  mode: 'resume' | 'from-start' | 'from-line'
  fileName?: string
  lineNumber?: number
  confirmToken?: string
  clearFailed: boolean
  clearOutput: boolean
}

export interface StartupResetSummary {
  mode: 'from-start' | 'from-line'
  fileName: string
  lineNumber?: number
  appliedAt: string
}

export async function applyStartupReset(
  config: StartupResetConfig,
): Promise<StartupResetSummary | null> {
  if (config.mode === 'resume' || !config.fileName) return null
  if (!config.confirmToken) {
    throw new Error('DATASET_RESET_CONFIRM is required when reset mode is not resume')
  }

  const appliedAt = new Date().toISOString()
  const statePath = join(config.inputDir, 'state', `${config.fileName}.state.json`)
  const archivePath = join(config.inputDir, 'archive', config.fileName)
  const pendingPath = join(config.inputDir, 'pending', config.fileName)
  const markerPath = join(
    config.inputDir,
    'state',
    'reset-consumed',
    `${encodeURIComponent(config.mode)}--${encodeURIComponent(config.fileName)}--${encodeURIComponent(config.confirmToken)}.json`,
  )
  const failedPath = join(
    config.inputDir,
    'failed',
    `${config.fileName.replace(/\.jsonl$/, '')}.failed.jsonl`,
  )

  await mkdir(join(config.inputDir, 'pending'), { recursive: true })
  await mkdir(join(config.inputDir, 'state', 'reset-consumed'), { recursive: true })

  if (await Bun.file(markerPath).exists()) return null

  if (config.mode === 'from-start') {
    if (await Bun.file(archivePath).exists()) {
      await rename(archivePath, pendingPath)
    }

    await rm(statePath, { force: true })
  } else {
    const current = await readDatasetState(config.inputDir, config.fileName)

    await writeDatasetState(config.inputDir, config.fileName, {
      fileName: config.fileName,
      nextLineNumber: config.lineNumber ?? 1,
      completedItemIds: [],
      failedItemIds: [],
      updatedAt: appliedAt,
    })

    if (
      !current &&
      !(await Bun.file(pendingPath).exists()) &&
      (await Bun.file(archivePath).exists())
    ) {
      await rename(archivePath, pendingPath)
    }
  }

  if (config.clearFailed) {
    await rm(failedPath, { force: true })
  }

  if (config.clearOutput) {
    console.warn(
      '[dataset-runner] DATASET_CLEAR_OUTPUT is deprecated and ignored; output is never auto-deleted.',
    )
  }

  await Bun.write(
    markerPath,
    JSON.stringify({
      mode: config.mode,
      fileName: config.fileName,
      ...(config.lineNumber !== undefined ? { lineNumber: config.lineNumber } : {}),
      confirmToken: config.confirmToken,
      appliedAt,
    }),
  )

  const summary: StartupResetSummary = {
    mode: config.mode,
    fileName: config.fileName,
    appliedAt,
  }

  if (config.mode === 'from-line' && config.lineNumber !== undefined) {
    summary.lineNumber = config.lineNumber
  }

  return summary
}
