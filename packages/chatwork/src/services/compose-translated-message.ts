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

interface RenderContext {
  mode: 'original' | 'translated'
  translatedSegments: string[]
  nextTranslationIndex: number
}

export async function composeTranslatedMessage(
  command: TranslationIngressCommand,
  params: ComposeParams,
): Promise<ComposeResult> {
  const envelope = getDecorationSnapshotEnvelope(command)
  const snapshot = envelope.snapshot
  const memberCache = params.memberCache ?? new Map<number, string>()

  // Resolve sender name
  const senderName = await resolveMemberDisplayNameSafe(
    command.sourceRoomId,
    command.senderAccountId,
    params.apiToken,
    memberCache,
  )

  // Build header line
  const eventType = command.sourceEventType === 'message_created' ? 'Created' : 'Updated'
  const header = `[piconname:${String(command.senderAccountId)}] ${senderName} 🇻🇳 [${eventType}]`

  // Context is mutated during rendering; create fresh context for each render pass
  // Render original body (mode='original' preserves literal content)
  const originalContext: RenderContext = {
    mode: 'original',
    translatedSegments: params.translatedSegments,
    nextTranslationIndex: 0,
  }
  const originalBody = await renderNodes(snapshot.renderTemplate, originalContext)

  // Render translated body (mode='translated' substitutes translations)
  const translatedContext: RenderContext = {
    mode: 'translated',
    translatedSegments: params.translatedSegments,
    nextTranslationIndex: 0,
  }
  const translatedBody = await renderNodes(snapshot.renderTemplate, translatedContext)

  // Validate all translated segments were consumed
  if (translatedContext.nextTranslationIndex !== params.translatedSegments.length) {
    throw new Error(
      `Unused translated segments: expected ${String(params.translatedSegments.length)}, ` +
        `used ${String(translatedContext.nextTranslationIndex)}`,
    )
  }

  // Compose single message
  const message = [header, originalBody, '[hr]', translatedBody].join('\n')

  return { message }
}

async function renderNodes(nodes: MessageRenderNode[], context: RenderContext): Promise<string> {
  const rendered = await Promise.all(nodes.map((node) => renderNode(node, context)))
  return rendered.join('')
}

async function renderNode(node: MessageRenderNode, context: RenderContext): Promise<string> {
  if (node.type === 'literal') {
    // Whitespace-only content (newlines, spaces) is preserved as-is in both modes
    // to maintain message structure without consuming translation segments
    if (node.content.trim().length === 0) {
      return node.content
    }

    if (context.mode === 'original') {
      // Original mode: return literal content as-is
      return node.content
    }

    // Translated mode: substitute translation segment
    const translated = context.translatedSegments[context.nextTranslationIndex]
    if (translated === undefined) {
      throw new Error('Not enough translated segments to compose message body')
    }

    context.nextTranslationIndex += 1
    return preserveOuterWhitespace(node.content, translated)
  }

  if (node.type === 'translationSlot') {
    const translated = context.translatedSegments[node.index]
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

  const children = await renderNodes(node.children, context)

  switch (node.type) {
    case 'info':
    case 'title':
    case 'quote':
      return `[${node.type}]${children}[/${node.type}]`

    case 'qt': {
      const qtmetaTag = buildQtmetaTag(node.quoteMeta)
      return `[qt]${qtmetaTag}${children}[/qt]`
    }

    default: {
      const _exhaustive: never = node
      throw new Error(`Unhandled node type: ${(node as MessageRenderNode).type}`)
    }
  }
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
