import { Elysia } from 'elysia'

export const healthRoutes = new Elysia({ name: 'translator:health' }).get('/health', () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))
