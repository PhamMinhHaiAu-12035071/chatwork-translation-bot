import type { TranslationIngressCommand } from '@chatwork-bot/core'
import type { ChatworkWebhookPayload } from '~/types/webhook'
import type {
  MessageDecorationSnapshot,
  MessageRenderNode,
  QuoteMeta,
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

  const quoteSummary = await buildQuoteSummary(
    normalizeQuoteMeta(snapshot.metadata.quoteMetadata),
    command,
    params.apiToken,
    memberCache,
  )
  if (quoteSummary !== undefined) {
    metadataLines.push(`Quote: ${quoteSummary}`)
  }

  let nextTranslationIndex = 0
  let globalQuoteMetadataConsumed = false

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

    if (node.type === 'info' || node.type === 'title' || node.type === 'quote') {
      const children = await renderNodes(node.children)
      return `[${node.type}]${children}[/${node.type}]`
    }

    const quoteMetadata =
      normalizeQuoteMeta(node.quoteMeta) ??
      (!globalQuoteMetadataConsumed
        ? normalizeQuoteMeta(snapshot.metadata.quoteMetadata)
        : undefined)

    if (quoteMetadata !== undefined && node.quoteMeta === undefined) {
      globalQuoteMetadataConsumed = true
    }

    const body = await renderNodes(node.children)
    const header = await buildQuoteHeader(quoteMetadata, command, params.apiToken, memberCache)
    const inner = header !== undefined ? `${header}${body.length > 0 ? `\n${body}` : ''}` : body
    return `[qt]${inner}[/qt]`
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

function normalizeQuoteMeta(
  quoteMeta:
    | QuoteMeta
    | {
        quoteSenderAccountId: number
        quoteTimestamp: number
      }
    | undefined,
): QuoteMeta | undefined {
  if (quoteMeta === undefined) return undefined

  const rawSenderAccountId =
    'senderAccountId' in quoteMeta ? quoteMeta.senderAccountId : quoteMeta.quoteSenderAccountId
  const rawTimestamp = 'timestamp' in quoteMeta ? quoteMeta.timestamp : quoteMeta.quoteTimestamp

  const senderAccountId = rawSenderAccountId === 0 ? undefined : rawSenderAccountId
  const timestamp = rawTimestamp === 0 ? undefined : rawTimestamp

  if (senderAccountId === undefined && timestamp === undefined) {
    return undefined
  }

  return {
    senderAccountId,
    timestamp,
  }
}

async function buildQuoteHeader(
  quoteMeta: QuoteMeta | undefined,
  command: TranslationIngressCommand,
  apiToken: string,
  memberCache: Map<number, string>,
): Promise<string | undefined> {
  if (quoteMeta === undefined) return undefined

  const content = await buildQuoteSummary(quoteMeta, command, apiToken, memberCache)
  if (content === undefined) return undefined

  return `── ${content} ──`
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
