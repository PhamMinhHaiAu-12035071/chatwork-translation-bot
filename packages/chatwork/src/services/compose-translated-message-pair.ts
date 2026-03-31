import type { TranslationIngressCommand } from '@chatwork-bot/core'
import type { ChatworkWebhookPayload } from '~/types/webhook'
import type {
  MessageDecorationContext,
  MessageDecorationSnapshot,
  MessageRenderNode,
  QuoteMeta,
  ReplyToData,
} from '~/types/message-decoration'
import { resolveRoomDisplayName } from './resolve-room-display-name'
import { resolveRoomMemberDisplayName } from './resolve-room-member-display-name'

interface DecorationSnapshotEnvelope {
  webhookPayload: ChatworkWebhookPayload
  snapshot: MessageDecorationSnapshot
}

interface ComposeTranslatedMessagePairParams {
  translatedSegments: string[]
  apiToken: string
  memberCache?: Map<number, string>
  roomCache?: Map<number, string>
}

export async function composeTranslatedMessagePair(
  command: TranslationIngressCommand,
  params: ComposeTranslatedMessagePairParams,
): Promise<{ metadataMessage: string; bodyMessage: string }> {
  const envelope = getDecorationSnapshotEnvelope(command)
  const snapshot = envelope.snapshot
  const memberCache = params.memberCache ?? new Map<number, string>()
  const roomCache = params.roomCache ?? new Map<number, string>()

  const senderName = await resolveMemberDisplayNameSafe(
    command.sourceRoomId,
    command.senderAccountId,
    params.apiToken,
    memberCache,
  )
  const roomName = await resolveRoomDisplayName(command.sourceRoomId, params.apiToken, roomCache)

  const metadataLines = [
    `Event: ${command.sourceEventType.replace(/^message_/, '')}`,
    `Sender: ${senderName}`,
    `Room: ${roomName}`,
    `Sent: ${formatUtcTimestamp(command.sendTime)}`,
  ]

  if (command.sourceEventType === 'message_updated' && command.updateTime > 0) {
    metadataLines.push(`Updated: ${formatUtcTimestamp(command.updateTime)}`)
  }

  if (snapshot.metadata.toAccountIds.length > 0) {
    metadataLines.push(
      `To: ${(
        await Promise.all(
          snapshot.metadata.toAccountIds.map((accountId) =>
            resolveMemberDisplayNameSafe(
              command.sourceRoomId,
              accountId,
              params.apiToken,
              memberCache,
            ),
          ),
        )
      ).join(', ')}`,
    )
  }

  if (snapshot.metadata.ccAccountIds.length > 0) {
    metadataLines.push(
      `Cc: ${(
        await Promise.all(
          snapshot.metadata.ccAccountIds.map((accountId) =>
            resolveMemberDisplayNameSafe(
              command.sourceRoomId,
              accountId,
              params.apiToken,
              memberCache,
            ),
          ),
        )
      ).join(', ')}`,
    )
  }

  if (snapshot.metadata.replyToData !== undefined) {
    const replySender = await resolveMemberDisplayNameSafe(
      command.sourceRoomId,
      snapshot.metadata.replyToData.replyAccountId,
      params.apiToken,
      memberCache,
    )
    const replyRoom = await resolveRoomDisplayName(
      snapshot.metadata.replyToData.replyRoomId,
      params.apiToken,
      roomCache,
    )
    metadataLines.push(
      `Reply to: ${replySender} | ${replyRoom} | ${snapshot.metadata.replyToData.replyMessageId}`,
    )
  }

  metadataLines.push(
    ...(await buildQuoteChainSummaries(
      snapshot.renderTemplate,
      command,
      params.apiToken,
      memberCache,
      roomCache,
    )),
  )

  let nextTranslationIndex = 0

  const renderNodes = async (nodes: MessageRenderNode[]): Promise<string> => {
    const rendered = await Promise.all(nodes.map((node) => renderNode(node)))
    return rendered.join('')
  }

  const renderNode = async (node: MessageRenderNode): Promise<string> => {
    if (node.type === 'literal') {
      if (node.content.trim().length === 0) {
        return node.content
      }

      const translated = params.translatedSegments[nextTranslationIndex]
      if (translated === undefined) {
        throw new Error('Not enough translated segments to compose message body')
      }

      nextTranslationIndex += 1
      return preserveOuterWhitespace(node.content, translated)
    }

    if (node.type === 'translationSlot') {
      const translated = params.translatedSegments[node.index]
      if (translated === undefined) {
        throw new Error('Missing translated segment for translation slot')
      }
      return translated
    }

    if (node.type === 'hr') {
      return '[hr]'
    }

    if (node.type === 'code') {
      return `[code]${node.content}[/code]`
    }

    if (node.type === 'rp') {
      const { replyAccountId, replyRoomId, replyMessageId } = node.replyToData
      // Chatwork API requires '-' delimiter, not ':'
      return `[rp aid=${String(replyAccountId)} to=${String(replyRoomId)}-${replyMessageId}]`
    }

    const children = await renderNodes(node.children)

    if (node.type === 'info' || node.type === 'title' || node.type === 'quote') {
      return `[${node.type}]${children}[/${node.type}]`
    }

    const qtmetaTag = buildQtmetaTag(node.quoteMeta)
    return `[qt]${qtmetaTag}${children}[/qt]`
  }

  const bodyMessage = await renderNodes(snapshot.renderTemplate)

  if (nextTranslationIndex !== params.translatedSegments.length) {
    throw new Error('Unused translated segments remained after composing message body')
  }

  return {
    metadataMessage: `[info][title]Translation metadata[/title]${metadataLines.join('\n')}[/info]`,
    bodyMessage,
  }
}

function getDecorationSnapshotEnvelope(
  command: TranslationIngressCommand,
): DecorationSnapshotEnvelope {
  const envelope = command.audit.rawSourceSnapshot as Partial<DecorationSnapshotEnvelope>
  if (envelope.snapshot == null || envelope.webhookPayload == null) {
    throw new Error('Missing decoration snapshot in audit.rawSourceSnapshot')
  }

  return envelope as DecorationSnapshotEnvelope
}

function formatUtcTimestamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 16).replace('T', ' ')
}

function preserveOuterWhitespace(original: string, translated: string): string {
  const leading = (/^\s*/u.exec(original) ?? [''])[0]
  const trailing = (/\s*$/u.exec(original) ?? [''])[0]
  return `${leading}${translated}${trailing}`
}

function buildQtmetaTag(quoteMeta: QuoteMeta): string {
  const parts: string[] = []
  if (quoteMeta.senderAccountId !== undefined) {
    parts.push(`aid=${String(quoteMeta.senderAccountId)}`)
  }
  if (quoteMeta.timestamp !== undefined) {
    parts.push(`time=${String(quoteMeta.timestamp)}`)
  }
  return parts.length > 0 ? `[qtmeta ${parts.join(' ')}]` : ''
}

interface QuoteSummaryEntry {
  context: MessageDecorationContext
  quoteMeta: QuoteMeta | undefined
}

function collectQuoteSummaryEntries(
  nodes: MessageRenderNode[],
  entries: QuoteSummaryEntry[] = [],
): QuoteSummaryEntry[] {
  for (const node of nodes) {
    if (node.type === 'quote' || node.type === 'qt') {
      entries.push({
        context: node.context,
        quoteMeta: node.type === 'qt' ? node.quoteMeta : undefined,
      })
      collectQuoteSummaryEntries(node.children, entries)
      continue
    }

    if ('children' in node) {
      collectQuoteSummaryEntries(node.children, entries)
    }
  }

  return entries
}

async function buildQuoteChainSummaries(
  nodes: MessageRenderNode[],
  command: TranslationIngressCommand,
  apiToken: string,
  memberCache: Map<number, string>,
  roomCache: Map<number, string>,
): Promise<string[]> {
  const entries = collectQuoteSummaryEntries(nodes)
  const lines: string[] = []

  for (const [index, entry] of entries.entries()) {
    const segments = await buildQuoteSummarySegments(
      entry,
      command,
      apiToken,
      memberCache,
      roomCache,
    )
    if (segments.length === 0) continue
    lines.push(`Quote ${String(index + 1)}: ${segments.join(' | ')}`)
  }

  return lines
}

async function buildQuoteSummarySegments(
  entry: QuoteSummaryEntry,
  command: TranslationIngressCommand,
  apiToken: string,
  memberCache: Map<number, string>,
  roomCache: Map<number, string>,
): Promise<string[]> {
  const segments: string[] = []
  const quoteSummary = await buildQuoteSummary(entry.quoteMeta, command, apiToken, memberCache)
  if (quoteSummary !== undefined) {
    segments.push(quoteSummary)
  }

  const replySummary = await buildReplySummary(
    entry.context.replyToData,
    command,
    apiToken,
    memberCache,
    roomCache,
  )
  if (replySummary !== undefined) {
    segments.push(`Reply to: ${replySummary}`)
  }

  const toSummary = await buildAccountListSummary(
    entry.context.toAccountIds,
    command,
    apiToken,
    memberCache,
  )
  if (toSummary !== undefined) {
    segments.push(`To: ${toSummary}`)
  }

  const ccSummary = await buildAccountListSummary(
    entry.context.ccAccountIds,
    command,
    apiToken,
    memberCache,
  )
  if (ccSummary !== undefined) {
    segments.push(`Cc: ${ccSummary}`)
  }

  return segments
}

async function buildQuoteSummary(
  quoteMeta: QuoteMeta | undefined,
  command: TranslationIngressCommand,
  apiToken: string,
  memberCache: Map<number, string>,
): Promise<string | undefined> {
  if (quoteMeta === undefined) return undefined

  const sender =
    quoteMeta.senderAccountId !== undefined
      ? await resolveMemberDisplayNameSafe(
          command.sourceRoomId,
          quoteMeta.senderAccountId,
          apiToken,
          memberCache,
        )
      : undefined
  const time =
    quoteMeta.timestamp !== undefined ? formatUtcTimestamp(quoteMeta.timestamp) : undefined

  if (sender !== undefined && time !== undefined) return `${sender} | ${time}`
  if (sender !== undefined) return sender
  if (time !== undefined) return time
  return undefined
}

async function buildReplySummary(
  replyToData: ReplyToData | undefined,
  command: TranslationIngressCommand,
  apiToken: string,
  memberCache: Map<number, string>,
  roomCache: Map<number, string>,
): Promise<string | undefined> {
  if (replyToData === undefined) return undefined

  const replySender = await resolveMemberDisplayNameSafe(
    command.sourceRoomId,
    replyToData.replyAccountId,
    apiToken,
    memberCache,
  )
  const replyRoom = await resolveRoomDisplayName(replyToData.replyRoomId, apiToken, roomCache)
  return `${replySender} | ${replyRoom} | ${replyToData.replyMessageId}`
}

async function buildAccountListSummary(
  accountIds: number[],
  command: TranslationIngressCommand,
  apiToken: string,
  memberCache: Map<number, string>,
): Promise<string | undefined> {
  if (accountIds.length === 0) return undefined

  return (
    await Promise.all(
      accountIds.map((accountId) =>
        resolveMemberDisplayNameSafe(command.sourceRoomId, accountId, apiToken, memberCache),
      ),
    )
  ).join(', ')
}

async function resolveMemberDisplayNameSafe(
  roomId: number,
  accountId: number,
  token: string,
  cache: Map<number, string>,
): Promise<string> {
  try {
    return await resolveRoomMemberDisplayName(roomId, accountId, token, cache)
  } catch {
    return `#${String(accountId)}`
  }
}
