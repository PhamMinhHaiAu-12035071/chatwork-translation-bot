import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { AsyncLogger } from './async-logger'

describe('AsyncLogger', () => {
  let logger: AsyncLogger
  let writeSpy: ReturnType<typeof mock>
  
  beforeEach(() => {
    writeSpy = mock()
    logger = new AsyncLogger({
      maxBufferSize: 3,
      flushIntervalMs: 50,
      writer: writeSpy,
    })
  })
  
  afterEach(async () => {
    await logger.shutdown()
  })
  
  it('should buffer logs and flush when buffer is full', async () => {
    logger.log({ level: 'info', message: 'test1' })
    logger.log({ level: 'info', message: 'test2' })
    expect(writeSpy).not.toHaveBeenCalled()
    
    logger.log({ level: 'info', message: 'test3' })
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(writeSpy).toHaveBeenCalled()
    const output = writeSpy.mock.calls[0]?.[0] as string
    expect(output).toContain('test1')
    expect(output).toContain('test2')
    expect(output).toContain('test3')
  })
  
  it('should flush on timer interval', async () => {
    logger.log({ level: 'info', message: 'delayed' })
    expect(writeSpy).not.toHaveBeenCalled()
    
    await new Promise(resolve => setTimeout(resolve, 60))
    
    expect(writeSpy).toHaveBeenCalled()
  })
  
  it('should flush on shutdown', async () => {
    logger.log({ level: 'info', message: 'shutdown-test' })
    
    await logger.shutdown()
    
    expect(writeSpy).toHaveBeenCalled()
  })
})
