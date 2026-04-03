import type { TranslationIngressCommand } from '@chatwork-bot/core'
import type { ChatworkWebhookPayload } from '~/types/webhook'
import type {
  MessageDecorationSnapshot,
  MessageRenderNode,
  QuoteMeta,
} from '~/types/message-decoration'
import { parseMessageDecoration } from './parse-message-decoration'
import { resolveRoomDisplayName } from './resolve-room-display-name'
import { resolveRoomMemberDisplayName } from './resolve-room-member-display-name'

interface DecorationSnapshotEnvelope {
  webhookPayload: ChatworkWebhookPayload
  snapshot: MessageDecorationSnapshot
}

export interface ComposeParams {
  translatedSegments: string[]
  apiToken: string
  memberCache?: Map<number, string>
  roomCache?: Map<number, string>
}

interface ComposeResult {
  message: string
}

export async function composeTranslatedMessage(
  command: TranslationIngressCommand,
  params: ComposeParams,
): Promise<ComposeResult> {
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

  // To/Cc/Reply/Quote summaries removed - body message now preserves full structure with [rp] and [qtmeta] tags

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

  validateComposedBodyStructure(snapshot.renderTemplate, bodyMessage)

  if (nextTranslationIndex !== params.translatedSegments.length) {
    throw new Error('Unused translated segments remained after composing message body')
  }

  // Temporary format - keeping old logic for now, will refactor in next task
  const metadataMessage = `[piconname:${String(command.senderAccountId)}]\n${metadataLines.join('\n')}`
  const message = `${metadataMessage}\n${bodyMessage}`

  return { message }
}

// Backward-compatible wrapper - temporarily keep old function for existing tests
// Will be removed in next task
export async function composeTranslatedMessagePair(
  command: TranslationIngressCommand,
  params: ComposeParams,
): Promise<{ metadataMessage: string; bodyMessage: string }> {
  // This is a temporary implementation to keep old tests passing
  // The new function returns { message } format, but we need to split it back
  // In the next task, this will be removed and tests will be updated
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

  validateComposedBodyStructure(snapshot.renderTemplate, bodyMessage)

  if (nextTranslationIndex !== params.translatedSegments.length) {
    throw new Error('Unused translated segments remained after composing message body')
  }

  return {
    metadataMessage: `[piconname:${String(command.senderAccountId)}]\n${metadataLines.join('\n')}`,
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

function validateComposedBodyStructure(
  originalRenderTemplate: MessageRenderNode[],
  composedBody: string,
): void {
  const reparsedTemplate = parseMessageDecoration(composedBody).renderTemplate
  const originalSignature = createStructureSignature(originalRenderTemplate)
  const reparsedSignature = createStructureSignature(reparsedTemplate)

  if (originalSignature !== reparsedSignature) {
    throw new Error('Composed translated body changed the original message structure')
  }
}

function createStructureSignature(nodes: MessageRenderNode[]): string {
  return nodes.map((node) => createNodeStructureSignature(node)).join('|')
}

function createNodeStructureSignature(node: MessageRenderNode): string {
  if (node.type === 'literal') {
    return node.content.trim().length === 0
      ? `literal:whitespace:${JSON.stringify(node.content)}`
      : 'literal:text'
  }

  if (node.type === 'translationSlot') {
    return 'literal:text'
  }

  if (node.type === 'hr') {
    return 'hr'
  }

  if (node.type === 'code') {
    return `code:${JSON.stringify(node.content)}`
  }

  if (node.type === 'rp') {
    return `rp:${node.replyToData.replyAccountId.toString()}:${node.replyToData.replyRoomId.toString()}:${node.replyToData.replyMessageId}`
  }

  if (node.type === 'info' || node.type === 'title' || node.type === 'quote') {
    return `${node.type}(${createStructureSignature(node.children)})`
  }

  return `qt:${node.quoteMeta.senderAccountId?.toString() ?? ''}:${node.quoteMeta.timestamp?.toString() ?? ''}(${createStructureSignature(node.children)})`
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
