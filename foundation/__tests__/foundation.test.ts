import { describe, it, expect } from 'vitest'
import { FOUNDATION_VERSION } from '../index'

describe('Foundation scaffold', () => {
  it('exports FOUNDATION_VERSION', () => {
    expect(FOUNDATION_VERSION).toBe('0.1.0')
  })

  it('is importable without errors', () => {
    expect(typeof FOUNDATION_VERSION).toBe('string')
  })
})
