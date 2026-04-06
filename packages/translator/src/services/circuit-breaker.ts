type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerConfig {
  failureThreshold: number      // Number of failures before opening
  resetTimeoutMs: number         // Time before transitioning to HALF_OPEN
  halfOpenMaxAttempts: number    // Max attempts in HALF_OPEN before re-opening
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private lastFailureTime: number | null = null
  private halfOpenAttempts = 0
  
  constructor(private config: CircuitBreakerConfig) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.updateState()
    
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN - failing fast')
    }
    
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private updateState(): void {
    if (this.state === 'OPEN' && this.shouldAttemptReset()) {
      this.state = 'HALF_OPEN'
      this.halfOpenAttempts = 0
    }
  }
  
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false
    
    const elapsedMs = Date.now() - this.lastFailureTime
    return elapsedMs >= this.config.resetTimeoutMs
  }
  
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      // Success in HALF_OPEN → reset to CLOSED
      this.state = 'CLOSED'
      this.failureCount = 0
      this.lastFailureTime = null
    }
    
    // Success in CLOSED → reset failure count
    if (this.state === 'CLOSED') {
      this.failureCount = 0
    }
  }
  
  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.state === 'HALF_OPEN') {
      // Failure in HALF_OPEN → reopen immediately
      this.state = 'OPEN'
      this.halfOpenAttempts = 0
      return
    }
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN'
    }
  }
  
  getState(): CircuitState {
    this.updateState()
    return this.state
  }
  
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    }
  }
}

// Global circuit breakers for external services
export const chatworkApiBreaker = new CircuitBreaker({
  failureThreshold: parseInt(process.env['CHATWORK_API_FAILURE_THRESHOLD'] || '5', 10),
  resetTimeoutMs: parseInt(process.env['CHATWORK_API_RESET_TIMEOUT_MS'] || '30000', 10),
  halfOpenMaxAttempts: 1,
})

export const llmProviderBreaker = new CircuitBreaker({
  failureThreshold: parseInt(process.env['LLM_PROVIDER_FAILURE_THRESHOLD'] || '3', 10),
  resetTimeoutMs: parseInt(process.env['LLM_PROVIDER_RESET_TIMEOUT_MS'] || '60000', 10),
  halfOpenMaxAttempts: 1,
})
