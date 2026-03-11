import { env } from './env'
import { createServer } from './server'
import { QueueRunner } from '~/services/queue-runner'

const runner = new QueueRunner({
  autorun: env.DATASET_AUTORUN,
  inputDir: env.DATASET_INPUT_DIR,
  outputBaseDir: process.env['OUTPUT_BASE_DIR'] ?? './output',
  defaultOriginalRoomId: env.CHATWORK_ORIGINAL_ROOM_ID,
  apiToken: env.CHATWORK_API_TOKEN,
  cooldownMs: env.DATASET_COOLDOWN_MS,
  maxRetries: env.DATASET_MAX_RETRIES,
  timeoutMs: env.DATASET_ITEM_TIMEOUT_MS,
  resetMode: env.DATASET_RESET_MODE,
  ...(env.DATASET_RESET_FILE !== undefined ? { resetFile: env.DATASET_RESET_FILE } : {}),
  ...(env.DATASET_RESET_LINE !== undefined ? { resetLine: env.DATASET_RESET_LINE } : {}),
  ...(env.DATASET_RESET_CONFIRM !== undefined ? { resetConfirm: env.DATASET_RESET_CONFIRM } : {}),
  clearFailed: env.DATASET_CLEAR_FAILED,
  clearOutput: env.DATASET_CLEAR_OUTPUT,
})

const runPromise = runner.run()

void runPromise.catch((error: unknown) => {
  console.error(
    JSON.stringify({ level: 'error', event: 'queue-loop-failed', error: String(error) }),
  )
  process.exit(1)
})

const server = createServer({
  getStatus: () => runner.getStatus(),
  onDeliveryAck: (ack) => runner.handleDeliveryAck(ack),
})
server.listen(env.DATASET_RUNNER_PORT)

console.log(`[dataset-runner] Listening on http://0.0.0.0:${env.DATASET_RUNNER_PORT.toString()}`)

let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  console.error(JSON.stringify({ level: 'info', event: 'shutdown', signal }))
  runner.shutdown()
  await runPromise.catch(() => undefined)
  process.exit(0)
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
process.on('SIGINT', () => {
  void shutdown('SIGINT')
})
