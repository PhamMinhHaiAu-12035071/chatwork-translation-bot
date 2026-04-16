import { Elysia, t } from 'elysia'
import { KagiBrowserService, KagiSidecarError, type KagiHealthSnapshot } from './browser-service'
import type { KagiTranslateUiRequest, TranslateResult } from './types/browser.interface'
import { KAGI_STYLE_VALUES } from '@chatwork-bot/provider-kagi'
import type { KagiStyle } from '@chatwork-bot/provider-kagi'

interface KagiServerLogger {
  info(event: string, context: Record<string, unknown>): void
  warn(event: string, context: Record<string, unknown>): void
  error(event: string, context: Record<string, unknown>): void
}

export interface KagiTranslationService {
  translate(request: KagiTranslateUiRequest): Promise<TranslateResult>
  getHealthSnapshot(): KagiHealthSnapshot
}

function createLogger(): KagiServerLogger {
  function log(level: 'info' | 'warn' | 'error', event: string, context: Record<string, unknown>) {
    const line = JSON.stringify({
      level,
      service: 'kagi-sidecar',
      event,
      timestamp: new Date().toISOString(),
      ...context,
    })

    if (level === 'error') {
      console.error(line)
      return
    }

    if (level === 'warn') {
      console.warn(line)
      return
    }

    console.log(line)
  }

  return {
    info: (event, context) => {
      log('info', event, context)
    },
    warn: (event, context) => {
      log('warn', event, context)
    },
    error: (event, context) => {
      log('error', event, context)
    },
  }
}

function isKagiStyle(value: string): value is KagiStyle {
  return KAGI_STYLE_VALUES.includes(value as KagiStyle)
}

/**
 * POST /translate
 * { "text": "Hello", "style": "Clear", "context": "software team" }
 *
 * 200
 * { "translated": "Xin chao" }
 */
export function createKagiServer(
  options: {
    service?: KagiTranslationService
    logger?: KagiServerLogger
  } = {},
) {
  const service = options.service ?? new KagiBrowserService()
  const logger = options.logger ?? createLogger()

  return new Elysia({ name: 'kagi-sidecar' })
    .get('/health', () => {
      const snapshot = service.getHealthSnapshot()
      return {
        ok: snapshot.ready,
        ...snapshot,
      }
    })
    .post(
      '/translate',
      async ({ body, set }) => {
        const requestId = crypto.randomUUID()

        if (!isKagiStyle(body.style)) {
          set.status = 422
          return {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'style must be one of the supported Kagi presets',
            },
          }
        }

        logger.info('kagi_translate_started', {
          requestId,
          payloadCharCount: body.text.length,
          hasContext: typeof body.context === 'string' && body.context.trim().length > 0,
        })

        try {
          const result = await service.translate({
            text: body.text,
            style: body.style,
            ...(typeof body.context === 'string' ? { context: body.context } : {}),
          })

          logger.info('kagi_translate_completed', {
            requestId,
            translatedLength: result.translated.length,
          })

          return { translated: result.translated }
        } catch (error) {
          if (error instanceof KagiSidecarError) {
            set.status = error.status
            logger.warn('kagi_translate_failed', {
              requestId,
              errorCode: error.code,
              errorMessage: error.message,
            })
            return {
              error: {
                code: error.code,
                message: error.message,
              },
            }
          }

          set.status = 502
          logger.error('kagi_translate_failed', {
            requestId,
            errorCode: 'UNEXPECTED',
            errorMessage: error instanceof Error ? error.message : String(error),
          })
          return {
            error: {
              code: 'UNEXPECTED',
              message: error instanceof Error ? error.message : String(error),
            },
          }
        }
      },
      {
        body: t.Object({
          text: t.String({ minLength: 1 }),
          style: t.String({ minLength: 1 }),
          context: t.Optional(t.String()),
        }),
      },
    )
}
