export const KAGI_STYLE_VALUES = ['Wild', 'Easy', 'Clear', 'Smart', 'Fine', 'True'] as const
export type KagiStyle = (typeof KAGI_STYLE_VALUES)[number]

export interface KagiTranslateRequest {
  text: string
  style: KagiStyle
  context?: string
}

export interface KagiTranslateResponse {
  translated: string
}

export interface KagiErrorPayload {
  error: {
    code: string
    message: string
  }
}
