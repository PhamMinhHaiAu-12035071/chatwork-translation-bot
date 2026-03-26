import { Elysia } from 'elysia'
import { existsSync } from 'fs'
import { join, resolve } from 'path'

function resolveDashboardDist(): string {
  const prodPath = join(process.cwd(), 'dashboard-dist')
  if (existsSync(prodPath)) return prodPath
  return resolve(import.meta.dir, '../../../dashboard/dist')
}

const DASHBOARD_DIST = resolveDashboardDist()

export const staticRoutes = new Elysia({ name: 'static' }).get('/assets/*', ({ params }) => {
  const filePath = join(DASHBOARD_DIST, 'assets', params['*'])
  if (!existsSync(filePath)) return new Response('Not found', { status: 404 })
  return Bun.file(filePath)
})

export const spaCatchAll = new Elysia({ name: 'spa-catch-all' }).get('*', ({ request }) => {
  const url = new URL(request.url)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/internal/') ||
    url.pathname === '/webhook' ||
    url.pathname === '/health' ||
    url.pathname === '/docs' ||
    url.pathname.startsWith('/docs/')
  ) {
    return new Response('Not found', { status: 404 })
  }
  const indexPath = join(DASHBOARD_DIST, 'index.html')
  if (!existsSync(indexPath)) {
    return new Response('Dashboard not built. Run: bun run build:dashboard', { status: 503 })
  }
  return Bun.file(indexPath)
})
