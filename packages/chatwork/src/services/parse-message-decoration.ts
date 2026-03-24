import type {
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

export function parseMessageDecoration(body: string): MessageDecorationSnapshot {
  if (!body.trim()) {
    return {
      translationInputs: [],
      translatableText: '',
      renderTemplate: [],
      metadata: {
        toAccountIds: [],
        ccAccountIds: [],
        replyToData: undefined,
        quoteMetadata: undefined,
      },
    }
  }

  const inputs: string[] = []
  const metadata: {
    toAccountIds: number[]
    ccAccountIds: number[]
    replyToData: { replyAccountId: number; replyRoomId: number; replyMessageId: string } | undefined
    quoteMetadata: { quoteSenderAccountId: number; quoteTimestamp: number } | undefined
  } = {
    toAccountIds: [],
    ccAccountIds: [],
    replyToData: undefined,
    quoteMetadata: undefined,
  }

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
      const m = /aid=(\d+)\s+to=(\d+):([^\s\]]+)/i.exec(tagContent)
      if (m?.[3]) {
        attributes = {
          type: 'rp',
          aid: Number(m[1]),
          toRoom: Number(m[2]),
          toMessage: m[3],
        }
      }
    } else if (tagName === 'qtmeta') {
      const accountMatch = /account_id="?(\d+)"?/i.exec(attrPart)
      const timeMatch = /time="?(\d+)"?/i.exec(attrPart)
      attributes = {
        type: 'qtmeta',
        accountId: accountMatch ? Number(accountMatch[1]) : undefined,
        timestamp: timeMatch ? Number(timeMatch[1]) : undefined,
      }
    }

    return { name: tagName, isClosing: false, attributes }
  }

  function parseBody(untilTag: string | null = null): MessageRenderNode[] {
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
        } else if (['info', 'title', 'quote', 'qt'].includes(tag.name)) {
          const children = parseBody(tag.name)
          if (tag.name === 'qt') {
            let quoteMeta: QuoteMeta | undefined
            if (
              tag.attributes.type === 'qtmeta' &&
              (tag.attributes.accountId || tag.attributes.timestamp)
            ) {
              quoteMeta = {
                senderAccountId: tag.attributes.accountId,
                timestamp: tag.attributes.timestamp,
              }
            }
            nodes.push({
              type: 'qt',
              children,
              quoteMeta,
            })
          } else {
            nodes.push({
              type: tag.name as 'info' | 'title' | 'quote',
              children,
            })
          }
        } else if (tag.name === 'qtmeta') {
          if (tag.attributes.type === 'qtmeta') {
            if (tag.attributes.accountId || tag.attributes.timestamp) {
              metadata.quoteMetadata = {
                quoteSenderAccountId: tag.attributes.accountId ?? 0,
                quoteTimestamp: tag.attributes.timestamp ?? 0,
              }
            }
          }
          parseBody('qtmeta')
        } else if (tag.name === 'to') {
          if (tag.attributes.type === 'to') {
            metadata.toAccountIds.push(tag.attributes.accountId)
          }
        } else if (tag.name === 'cc') {
          if (tag.attributes.type === 'cc') {
            metadata.ccAccountIds.push(tag.attributes.accountId)
          }
        } else if (tag.name === 'rp') {
          if (tag.attributes.type === 'rp') {
            metadata.replyToData = {
              replyAccountId: tag.attributes.aid,
              replyRoomId: tag.attributes.toRoom,
              replyMessageId: tag.attributes.toMessage,
            }
          }
        } else {
          const children = parseBody(tag.name)
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

  const renderTemplate = parseBody()

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
    metadata: {
      toAccountIds: metadata.toAccountIds,
      ccAccountIds: metadata.ccAccountIds,
      replyToData: metadata.replyToData,
      quoteMetadata: metadata.quoteMetadata,
    },
  }
}
