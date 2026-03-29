import axios from 'axios'

export interface TurnstileSolveResponse {
  success: boolean
  token?: string
  error?: string
  time?: number
}

const SOLVER_URL = process.env['SOLVER_URL'] || 'http://localhost:8080'

export class TurnstileSolver {
  private static async checkHealth(): Promise<boolean> {
    try {
      const res = await axios.get(`${SOLVER_URL}/health`, { timeout: 3000 })
      return res.status === 200
    } catch {
      return false
    }
  }

  /**
   * Solve Turnstile for a given URL
   */
  static async solve(url: string, maxRetries = 3): Promise<string> {
    if (!(await this.checkHealth())) {
      throw new Error('Turnstile solver is not running. Please start it with: docker compose up -d')
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[TurnstileSolver] Attempt ${attempt}/${maxRetries} to solve for ${url}`)

        const response = await axios.post<TurnstileSolveResponse>(
          `${SOLVER_URL}/solve`,
          {
            url,
            sitekey: '0x4AAAAAAADnPIDROrmt1Wwj', // Common default or will be auto-detected
            action: 'submit',
          },
          { timeout: 30_000 },
        )

        const data = response.data

        if (data.success && data.token) {
          console.log(`[TurnstileSolver] Solved successfully in ${data.time || '?'}ms`)
          return data.token
        }

        if (attempt === maxRetries) {
          throw new Error(
            `Failed to solve Turnstile after ${maxRetries} attempts: ${data.error || 'Unknown error'}`,
          )
        }

        await new Promise((r) => setTimeout(r, 2000 * attempt))
      } catch (error: any) {
        if (attempt === maxRetries) {
          throw new Error(`Turnstile solver error: ${error.message}`)
        }
        console.warn(`[TurnstileSolver] Attempt ${attempt} failed, retrying...`)
      }
    }

    throw new Error('Turnstile solving failed')
  }

  /**
   * Inject solved token into page (for Cloudflare Turnstile)
   */
  static async injectToken(page: any, token: string): Promise<void> {
    await page.evaluate((cfToken: string) => {
      // Try multiple common ways to inject Turnstile token
      const inputs = document.querySelectorAll(
        'input[name="cf-turnstile-response"], input[ name*="turnstile" i]',
      )
      if (inputs.length > 0) {
        ;(inputs[0] as HTMLInputElement).value = cfToken
      }

      // Also set as global variable in case page uses it
      ;(window as any).__cfTurnstileToken = cfToken

      console.log('✅ Turnstile token injected')
    }, token)
  }
}
