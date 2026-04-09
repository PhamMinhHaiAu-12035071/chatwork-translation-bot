/**
 * Structured representation of parsed Chatwork message decoration.
 * Supports portable structure (info, title, code, quotes, hr) and extracts
 * source-dependent tags into metadata hints.
 */

export interface MessageDecorationSnapshot {
  // Ordered list of discrete text segments to translate
  translationInputs: string[]

  // Joined visible text for logs and backward compatibility
  translatableText: string

  // Portable render template with literal chunks and translation slots
  renderTemplate: MessageRenderNode[]

  // Metadata hints extracted from source-dependent tags
  metadata: MessageDecorationContext
}

export type MessageRenderNode =
  | { type: 'literal'; content: string }
  | { type: 'translationSlot'; index: number }
  | { type: 'hr' }
  | { type: 'code'; content: string }
  | { type: 'to'; accountId: number }
  | { type: 'cc'; accountId: number }
  | { type: 'rp'; replyToData: ReplyToData }
  | { type: 'info'; children: MessageRenderNode[] }
  | { type: 'title'; children: MessageRenderNode[] }
  | { type: 'quote'; children: MessageRenderNode[]; context: MessageDecorationContext }
  | {
      type: 'qt'
      children: MessageRenderNode[]
      quoteMeta: QuoteMeta
      context: MessageDecorationContext
    }

export interface QuoteMeta {
  senderAccountId?: number
  timestamp?: number
}

export interface ReplyToData {
  replyAccountId: number
  replyMessageId: string
  replyRoomId: number
}

export interface MessageDecorationContext {
  toAccountIds: number[]
  ccAccountIds: number[]
  replyToData: ReplyToData | undefined
}
