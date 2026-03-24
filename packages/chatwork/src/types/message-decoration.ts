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
  metadata: {
    toAccountIds: number[]
    ccAccountIds: number[]
    replyToData:
      | {
          replyAccountId: number
          replyMessageId: string
          replyRoomId: number
        }
      | undefined
    quoteMetadata:
      | {
          quoteSenderAccountId: number
          quoteTimestamp: number
        }
      | undefined
  }
}

export type MessageRenderNode =
  | { type: 'literal'; content: string }
  | { type: 'translationSlot'; index: number }
  | { type: 'hr' }
  | { type: 'code'; content: string }
  | { type: 'info'; children: MessageRenderNode[] }
  | { type: 'title'; children: MessageRenderNode[] }
  | { type: 'quote'; children: MessageRenderNode[] }
  | { type: 'qt'; children: MessageRenderNode[]; quoteMeta: QuoteMeta | undefined }

export interface QuoteMeta {
  senderAccountId: number | undefined
  timestamp: number | undefined
}
