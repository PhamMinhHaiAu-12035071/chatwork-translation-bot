import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatasetFileState } from '~/types/status'

export interface RunnerLockLease {
  lockPath: string
  ownerId: string
}

function statePath(baseDir: string, fileName: string): string {
  return join(baseDir, 'state', `${fileName}.state.json`)
}

export async function readDatasetState(
  baseDir: string,
  fileName: string,
): Promise<DatasetFileState | null> {
  const filepath = statePath(baseDir, fileName)
  const file = Bun.file(filepath)
  if (!(await file.exists())) return null
  return (await file.json()) as DatasetFileState
}

export async function writeDatasetState(
  baseDir: string,
  fileName: string,
  state: DatasetFileState,
): Promise<void> {
  const dir = join(baseDir, 'state')
  await mkdir(dir, { recursive: true })
  await writeFile(statePath(baseDir, fileName), JSON.stringify(state, null, 2))
}

export async function acquireRunnerLock(
  baseDir: string,
  staleMs: number,
): Promise<RunnerLockLease> {
  const dir = join(baseDir, 'state')
  const lockPath = join(dir, 'runner.lock')
  await mkdir(dir, { recursive: true })

  const stale = await stat(lockPath)
    .then((value) => Date.now() - value.mtimeMs > staleMs)
    .catch(() => false)
  if (stale) await rm(lockPath, { force: true })

  const ownerId = crypto.randomUUID()
  await writeFile(lockPath, JSON.stringify({ ownerId, heartbeatAt: new Date().toISOString() }), {
    flag: 'wx',
  })

  return { lockPath, ownerId }
}

export async function heartbeatRunnerLock(lease: RunnerLockLease): Promise<void> {
  await writeFile(
    lease.lockPath,
    JSON.stringify({ ownerId: lease.ownerId, heartbeatAt: new Date().toISOString() }),
  )
}

export async function releaseRunnerLock(lease: RunnerLockLease): Promise<void> {
  await rm(lease.lockPath, { force: true })
}
