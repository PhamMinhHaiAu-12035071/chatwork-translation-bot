import { Type as t, type Static } from '@sinclair/typebox'

/**
 * Neutral ingress contract for translation requests.
 * Accepts any source system (chatwork, slack, etc.) and provides raw snapshot metadata.
 * All fields are required.
 */
export const TranslationIngressCommandSchema = t.Object({
  sourceSystem: t.String(),
  sourceMessageId: t.String(),
  sourceRoomId: t.Number(),
  senderAccountId: t.Number(),
  rawBody: t.String(),
  translatableText: t.String(),
  sendTime: t.Number(),
  updateTime: t.Number(),
  audit: t.Object({
    receivedAt: t.String(),
    rawSourceSnapshot: t.Record(t.String(), t.Unknown()),
  }),
})

export type TranslationIngressCommand = Static<typeof TranslationIngressCommandSchema>
