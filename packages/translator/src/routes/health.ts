import { Elysia } from 'elysia'
import { chatworkApiBreaker, llmProviderBreaker } from '~/services/circuit-breaker'

export const healthRoutes = new Elysia({ name: 'translator:health' }).get('/health', () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  circuitBreakers: {
    chatworkApi: chatworkApiBreaker.getMetrics(),
    llmProvider: llmProviderBreaker.getMetrics(),
  },
}))
