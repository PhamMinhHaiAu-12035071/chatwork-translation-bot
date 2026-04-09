import type {
  MessageDecorationContext,
  MessageDecorationSnapshot,
  MessageRenderNode,
  QuoteMeta,
} from '~/types/message-decoration'

/**
 * Tolerant, recursive-descent parser for Chatwork message markup.
 */

type TagAttributes =
  | { type: 'to'; accountId: number }
  | { type: 'cc'; accountId: number }
  | { type: 'rp'; aid: number; toRoom: number; toMessage: string }
  | { type: 'qtmeta'; accountId: number | undefined; timestamp: number | undefined }
  | { type: 'other' }

function createDecorationContext(): MessageDecorationContext {
  return {
    toAccountIds: [],
    ccAccountIds: [],
    replyToData: undefined,
  }
}

function normalizeQuoteMeta(attributes: {
  accountId: number | undefined
  timestamp: number | undefined
}): QuoteMeta | undefined {
  if (attributes.accountId === undefined && attributes.timestamp === undefined) {
    return undefined
  }

  return {
    ...(attributes.accountId !== undefined ? { senderAccountId: attributes.accountId } : {}),
    ...(attributes.timestamp !== undefined ? { timestamp: attributes.timestamp } : {}),
  }
}

export function parseMessageDecoration(body: string): MessageDecorationSnapshot {
  if (!body.trim()) {
    return {
      translationInputs: [],
      translatableText: '',
      renderTemplate: [],
      metadata: createDecorationContext(),
    }
  }

  const inputs: string[] = []
  const metadata = createDecorationContext()

  let pos = 0

  function parseTag(): { name: string; isClosing: boolean; attributes: TagAttributes } | null {
    if (body[pos] !== '[') return null

    const closePos = body.indexOf(']', pos)
    if (closePos === -1) return null

    const tagContent = body.slice(pos + 1, closePos)
    pos = closePos + 1

    if (tagContent.toLowerCase() === 'hr') {
      return { name: 'hr', isClosing: false, attributes: { type: 'other' } }
    }

    if (tagContent.startsWith('/')) {
      return {
        name: tagContent.slice(1).toLowerCase(),
        isClosing: true,
        attributes: { type: 'other' },
      }
    }

    const tagMatch = /^([a-z]+)(.*)/i.exec(tagContent)
    if (!tagMatch?.[1]) return null

    const tagName = tagMatch[1].toLowerCase()
    const attrPart = tagMatch[2] ?? ''

    let attributes: TagAttributes = { type: 'other' }

    if (tagName === 'to') {
      const m = /^to:(\d+)$/i.exec(tagContent)
      if (m) attributes = { type: 'to', accountId: Number(m[1]) }
    } else if (tagName === 'cc') {
      const m = /^cc:(\d+)$/i.exec(tagContent)
      if (m) attributes = { type: 'cc', accountId: Number(m[1]) }
    } else if (tagName === 'rp') {
      const m = /aid=(\d+)\s+to=(\d+)(?:[:\-])([^\s\]]+)/i.exec(tagContent)
      if (m?.[3]) {
        attributes = {
          type: 'rp',
          aid: Number(m[1]),
          toRoom: Number(m[2]),
          toMessage: m[3],
        }
      }
    } else if (tagName === 'qtmeta') {
      const accountMatch = /(?:account_id|aid)="?(\d+)"?/i.exec(attrPart)
      const timeMatch = /time="?(\d+)"?/i.exec(attrPart)
      attributes = {
        type: 'qtmeta',
        accountId: accountMatch ? Number(accountMatch[1]) : undefined,
        timestamp: timeMatch ? Number(timeMatch[1]) : undefined,
      }
    }

    return { name: tagName, isClosing: false, attributes }
  }

  function parseBody(
    context: MessageDecorationContext,
    untilTag: string | null = null,
    quoteScope?: { quoteMeta: QuoteMeta | undefined },
  ): MessageRenderNode[] {
    const nodes: MessageRenderNode[] = []

    while (pos < body.length) {
      if (body[pos] === '[') {
        const tag = parseTag()
        if (!tag) {
          nodes.push({ type: 'literal', content: '[' })
          pos++
          continue
        }

        if (tag.isClosing) {
          if (untilTag && tag.name === untilTag) {
            return nodes
          }
          nodes.push({ type: 'literal', content: `[/${tag.name}]` })
          continue
        }

        if (tag.name === 'hr') {
          nodes.push({ type: 'hr' })
        } else if (tag.name === 'code') {
          let codeContent = ''
          while (pos < body.length) {
            if (body[pos] === '[') {
              const closeTag = parseTag()
              if (closeTag && closeTag.isClosing && closeTag.name === 'code') {
                break
              }
              if (closeTag) {
                codeContent = `${codeContent}[${closeTag.isClosing ? '/' : ''}${closeTag.name}]`
              } else {
                codeContent = `${codeContent}${body[pos] ?? ''}`
                pos++
              }
            } else {
              codeContent = `${codeContent}${body[pos] ?? ''}`
              pos++
            }
          }
          nodes.push({ type: 'code', content: codeContent })
        } else if (tag.name === 'info' || tag.name === 'title') {
          const children = parseBody(context, tag.name)
          nodes.push({
            type: tag.name,
            children,
          })
        } else if (tag.name === 'qtmeta') {
          if (quoteScope && tag.attributes.type === 'qtmeta') {
            quoteScope.quoteMeta = normalizeQuoteMeta(tag.attributes)
          }
          // Real Chatwork does not always send [/qtmeta]. Only consume to
          // the closing tag when it appears before the parent scope's closer.
          const closingQtmeta = body.indexOf('[/qtmeta]', pos)
          if (closingQtmeta !== -1) {
            const parentCloser = untilTag ? body.indexOf(`[/${untilTag}]`, pos) : -1
            if (parentCloser === -1 || closingQtmeta < parentCloser) {
              pos = closingQtmeta + '[/qtmeta]'.length
            }
          }
        } else if (tag.name === 'quote') {
          const quoteContext = createDecorationContext()
          const children = parseBody(quoteContext, tag.name)
          nodes.push({
            type: 'quote',
            children,
            context: quoteContext,
          })
        } else if (tag.name === 'qt') {
          const quoteContext = createDecorationContext()
          const nestedQuoteScope: { quoteMeta: QuoteMeta | undefined } = {
            quoteMeta: undefined,
          }
          const children = parseBody(quoteContext, tag.name, nestedQuoteScope)
          if (nestedQuoteScope.quoteMeta === undefined) {
            nodes.push({
              type: 'quote',
              children,
              context: quoteContext,
            })
          } else {
            nodes.push({
              type: 'qt',
              children,
              quoteMeta: nestedQuoteScope.quoteMeta,
              context: quoteContext,
            })
          }
        } else if (tag.name === 'to') {
          if (tag.attributes.type === 'to') {
            context.toAccountIds.push(tag.attributes.accountId)
            nodes.push({ type: 'to', accountId: tag.attributes.accountId })
          }
        } else if (tag.name === 'cc') {
          if (tag.attributes.type === 'cc') {
            context.ccAccountIds.push(tag.attributes.accountId)
            nodes.push({ type: 'cc', accountId: tag.attributes.accountId })
          }
        } else if (tag.name === 'rp') {
          if (tag.attributes.type === 'rp') {
            const replyToData = {
              replyAccountId: tag.attributes.aid,
              replyRoomId: tag.attributes.toRoom,
              replyMessageId: tag.attributes.toMessage,
            }
            // Store in context for metadata message
            context.replyToData = replyToData
            // Also create node to render [rp] tag in body message (needed for Chatwork UI)
            nodes.push({ type: 'rp', replyToData })
          }
        } else {
          const children = parseBody(context, tag.name)
          nodes.push(...children)
        }
      } else {
        const start = pos
        while (pos < body.length && body[pos] !== '[') {
          pos++
        }
        const text = body.slice(start, pos)
        if (text.length > 0) {
          nodes.push({ type: 'literal', content: text })
        }
      }
    }

    return nodes
  }

  const renderTemplate = parseBody(metadata)

  function extractInputs(nodes: MessageRenderNode[]): void {
    for (const node of nodes) {
      if (node.type === 'literal') {
        const literalNode = node as { type: 'literal'; content: string }
        const text = literalNode.content.trim()
        if (text.length > 0) {
          inputs.push(text)
        }
      } else if ('children' in node) {
        const withChildren = node as { children: MessageRenderNode[] }
        extractInputs(withChildren.children)
      }
    }
  }

  extractInputs(renderTemplate)

  const translatableText = inputs
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join('\n')

  return {
    translationInputs: inputs,
    translatableText,
    renderTemplate,
    metadata,
  }
}
