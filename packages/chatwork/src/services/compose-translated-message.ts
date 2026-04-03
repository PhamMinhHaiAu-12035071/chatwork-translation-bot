import type { TranslationIngressCommand } from '@chatwork-bot/core'
import type { ChatworkWebhookPayload } from '~/types/webhook'
import type {
  MessageDecorationSnapshot,
  MessageRenderNode,
  QuoteMeta,
} from '~/types/message-decoration'

interface DecorationSnapshotEnvelope {
  webhookPayload: ChatworkWebhookPayload
  snapshot: MessageDecorationSnapshot
}

export interface ComposeParams {
  translatedSegments: string[]
  apiToken: string
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

  // Build header line with emoji decoration
  const eventDecoration = command.sourceEventType === 'message_created'
    ? '🌿🌺🌿 𝐂𝐫𝐞𝐚𝐭𝐞𝐝 🌿🌺🌿'
    : '🔥⚡🔥 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 🔥⚡🔥'
  const header = `[piconname:${String(command.senderAccountId)}] ${eventDecoration}`

  // Render translated body only
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

  // Compose single message: header + translated body
  const message = `${header}\n${translatedBody}`

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

function getDecorationSnapshotEnvelope(
  command: TranslationIngressCommand,
): DecorationSnapshotEnvelope {
  const envelope = command.audit.rawSourceSnapshot as Partial<DecorationSnapshotEnvelope>
  if (envelope.snapshot == null || envelope.webhookPayload == null) {
    throw new Error('Missing decoration snapshot in audit.rawSourceSnapshot')
  }

  return envelope as DecorationSnapshotEnvelope
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
