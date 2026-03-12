import { describe, expect, it, mock } from 'bun:test'

void mock.module('@chatwork-bot/chatwork', () => ({
  deleteRoomMessage: mock(() => Promise.resolve()),
}))

describe('cleanupMessages', () => {
  it('calls deleteRoomMessage for source when only source is provided', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    deleteMock.mockImplementation(() => Promise.resolve())

    await cleanupMessages({ sourceRoomId: 111, sourceMessageId: 'src-1' }, 'test-token')

    expect(deleteMock.mock.calls.length).toBe(1)
    expect(deleteMock.mock.calls[0]).toEqual([111, 'src-1', 'test-token'])
  })

  it('calls deleteRoomMessage for both source and destination when both are provided', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    deleteMock.mockImplementation(() => Promise.resolve())

    await cleanupMessages(
      {
        sourceRoomId: 111,
        sourceMessageId: 'src-1',
        destRoomId: 222,
        destMessageId: 'dst-1',
      },
      'test-token',
    )

    expect(deleteMock.mock.calls.length).toBe(2)
    expect(deleteMock.mock.calls[0]).toEqual([111, 'src-1', 'test-token'])
    expect(deleteMock.mock.calls[1]).toEqual([222, 'dst-1', 'test-token'])
  })

  it('skips destination delete when destRoomId is absent', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    deleteMock.mockImplementation(() => Promise.resolve())

    await cleanupMessages(
      { sourceRoomId: 111, sourceMessageId: 'src-1', destMessageId: 'dst-1' },
      'test-token',
    )

    expect(deleteMock.mock.calls.length).toBe(1)
  })

  it('skips destination delete when destMessageId is absent', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    deleteMock.mockImplementation(() => Promise.resolve())

    await cleanupMessages(
      { sourceRoomId: 111, sourceMessageId: 'src-1', destRoomId: 222 },
      'test-token',
    )

    expect(deleteMock.mock.calls.length).toBe(1)
  })

  it('does not throw when source delete fails — logs warn and continues', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    deleteMock.mockImplementation(() => Promise.reject(new Error('404 not found')))

    const loggedLines: string[] = []
    const originalConsoleError = console.error
    const consoleErrorMock = mock((...args: unknown[]) => {
      loggedLines.push(args.map((a) => String(a)).join(' '))
    })
    console.error = consoleErrorMock as typeof console.error

    await cleanupMessages({ sourceRoomId: 111, sourceMessageId: 'src-1' }, 'test-token')

    expect(loggedLines.some((l) => l.includes('"event":"dataset_cleanup_failed"'))).toBe(true)
    expect(loggedLines.some((l) => l.includes('"level":"warn"'))).toBe(true)

    console.error = originalConsoleError
  })

  it('continues to delete destination even when source delete fails', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    let callCount = 0
    deleteMock.mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.reject(new Error('source fail'))
      return Promise.resolve()
    })

    const originalConsoleError = console.error
    const consoleErrorMock = mock(() => undefined)
    console.error = consoleErrorMock as typeof console.error

    await cleanupMessages(
      { sourceRoomId: 111, sourceMessageId: 'src-1', destRoomId: 222, destMessageId: 'dst-1' },
      'test-token',
    )

    expect(deleteMock.mock.calls.length).toBe(2)
    console.error = originalConsoleError
  })

  it('does not throw when destination delete fails — logs warn and continues', async () => {
    const { deleteRoomMessage } = await import('@chatwork-bot/chatwork')
    const { cleanupMessages } = await import('./message-cleaner')

    const deleteMock = deleteRoomMessage as ReturnType<typeof mock>
    deleteMock.mockClear()
    let callCount = 0
    deleteMock.mockImplementation(() => {
      callCount++
      if (callCount === 2) return Promise.reject(new Error('dest 404'))
      return Promise.resolve()
    })

    const loggedLines: string[] = []
    const originalConsoleError = console.error
    const consoleErrorMock = mock((...args: unknown[]) => {
      loggedLines.push(args.map((a) => String(a)).join(' '))
    })
    console.error = consoleErrorMock as typeof console.error

    await cleanupMessages(
      { sourceRoomId: 111, sourceMessageId: 'src-1', destRoomId: 222, destMessageId: 'dst-1' },
      'test-token',
    )

    expect(loggedLines.some((l) => l.includes('"event":"dataset_cleanup_failed"'))).toBe(true)
    console.error = originalConsoleError
  })
})
