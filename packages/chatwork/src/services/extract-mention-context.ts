import type { MessageDecorationContext, MessageRenderNode } from '~/types/message-decoration'

export interface MentionRecipient {
  accountId: number
  displayName: string
}

export interface MentionContext {
  toRecipients: MentionRecipient[]
  ccRecipients: MentionRecipient[]
  isToAll: boolean
}

/**
 * Walk render template to extract mention recipients with display names.
 * Display name = text before first newline in the literal node following a to/cc node.
 */
export function extractMentionContext(
  renderTemplate: MessageRenderNode[],
  metadata: MessageDecorationContext | undefined,
): MentionContext {
  const toRecipients: MentionRecipient[] = []
  const ccRecipients: MentionRecipient[] = []

  for (let i = 0; i < renderTemplate.length; i++) {
    const node = renderTemplate[i]
    if (node === undefined) continue

    if (node.type === 'to' || node.type === 'cc') {
      const displayName = peekDisplayName(renderTemplate, i + 1)
      const recipient: MentionRecipient = { accountId: node.accountId, displayName }

      if (node.type === 'to') {
        toRecipients.push(recipient)
      } else {
        ccRecipients.push(recipient)
      }
    }
  }

  return { toRecipients, ccRecipients, isToAll: metadata?.isToAll ?? false }
}

function peekDisplayName(nodes: MessageRenderNode[], index: number): string {
  const next = nodes[index]
  if (next?.type !== 'literal') return ''

  const firstLine = next.content.split('\n')[0] ?? ''
  return firstLine.trim()
}

/**
 * Build a concise English hint for the LLM about message addressing.
 * Returns undefined when no mentions are present (DEC-007).
 */
export function buildMentionHint(context: MentionContext): string | undefined {
  const { toRecipients, ccRecipients, isToAll } = context

  // isToAll overrides individual mentions (priority rule)
  if (isToAll) {
    return 'Addressed to all room members. Use plural address (mọi người/các anh chị).'
  }

  if (toRecipients.length === 0 && ccRecipients.length === 0) {
    return undefined
  }

  const toNames = toRecipients.map((r) => r.displayName).filter(Boolean)
  const ccNames = ccRecipients.map((r) => r.displayName).filter(Boolean)
  const ccSuffix = ccNames.length > 0 ? ` CC: ${ccNames.join(', ')}.` : ''

  const nameDirective =
    'When translating greetings or direct address, include the recipient\'s name naturally (e.g., "Chào anh/chị {Name}" not just "Chào anh/chị").'

  if (toRecipients.length === 1) {
    const name = toNames[0] ?? ''
    return `Directly addressed to 1 person: ${name}. Use singular address (anh/chị/bạn). ${nameDirective}${ccSuffix}`
  }

  const count = toRecipients.length
  return `Directly addressed to ${String(count)} people: ${toNames.join(', ')}. Use plural address. ${nameDirective}${ccSuffix}`
}
