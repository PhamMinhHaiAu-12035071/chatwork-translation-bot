import { Elysia } from 'elysia'

export const healthRoutes = new Elysia({ name: 'webhook-logger:health' }).get('/health', () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))
