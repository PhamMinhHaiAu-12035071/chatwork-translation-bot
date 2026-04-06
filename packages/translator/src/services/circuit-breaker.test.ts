import { describe, it, expect, beforeEach } from 'bun:test'
import { CircuitBreaker } from './circuit-breaker'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker
  
  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 1,
    })
  })
  
  it('should allow requests when circuit is closed', async () => {
    const fn = async () => 'success'
    
    const result = await breaker.execute(fn)
    
    expect(result).toBe('success')
    expect(breaker.getState()).toBe('CLOSED')
  })
  
  it('should open circuit after threshold failures', async () => {
    const fn = async () => {
      throw new Error('Service unavailable')
    }
    
    // Fail 3 times
    await expect(breaker.execute(fn)).rejects.toThrow()
    await expect(breaker.execute(fn)).rejects.toThrow()
    await expect(breaker.execute(fn)).rejects.toThrow()
    
    // Circuit should be OPEN
    expect(breaker.getState()).toBe('OPEN')
    
    // Next call should fail fast without calling fn
    await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN')
  })
  
  it('should transition to HALF_OPEN after reset timeout', async () => {
    const fn = async () => {
      throw new Error('Service unavailable')
    }
    
    // Open circuit
    await expect(breaker.execute(fn)).rejects.toThrow()
    await expect(breaker.execute(fn)).rejects.toThrow()
    await expect(breaker.execute(fn)).rejects.toThrow()
    
    expect(breaker.getState()).toBe('OPEN')
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 1100))
    
    expect(breaker.getState()).toBe('HALF_OPEN')
  })
  
  it('should close circuit if HALF_OPEN request succeeds', async () => {
    let shouldFail = true
    const fn = async () => {
      if (shouldFail) throw new Error('Fail')
      return 'success'
    }
    
    // Open circuit
    await expect(breaker.execute(fn)).rejects.toThrow()
    await expect(breaker.execute(fn)).rejects.toThrow()
    await expect(breaker.execute(fn)).rejects.toThrow()
    
    expect(breaker.getState()).toBe('OPEN')
    
    // Wait for HALF_OPEN
    await new Promise(resolve => setTimeout(resolve, 1100))
    expect(breaker.getState()).toBe('HALF_OPEN')
    
    // Next request succeeds
    shouldFail = false
    const result = await breaker.execute(fn)
    
    expect(result).toBe('success')
    expect(breaker.getState()).toBe('CLOSED')
  })
})
