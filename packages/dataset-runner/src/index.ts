import { env } from './env'
import { createServer } from './server'

const idleStatus = {
  mode: 'idle',
  autorun: env.DATASET_AUTORUN,
  pendingFiles: 0,
  completedCount: 0,
  failedCount: 0,
  updatedAt: new Date().toISOString(),
}

const server = createServer({
  getStatus: () => idleStatus,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onDeliveryAck: () => {},
})
server.listen(env.DATASET_RUNNER_PORT)

console.log(`[dataset-runner] Listening on http://0.0.0.0:${env.DATASET_RUNNER_PORT.toString()}`)
