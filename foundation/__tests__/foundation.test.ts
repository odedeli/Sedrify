import { describe, it, expect } from 'vitest'
import { FOUNDATION_VERSION } from '../index'

// This test verifies the Foundation module loads correctly.
// It checks type only — not a hardcoded version — so it never needs updating.
describe('Foundation', () => {
  it('exports FOUNDATION_VERSION as a non-empty string', () => {
    expect(typeof FOUNDATION_VERSION).toBe('string')
    expect(FOUNDATION_VERSION.length).toBeGreaterThan(0)
  })

  it('is importable without errors', () => {
    expect(FOUNDATION_VERSION).toBeTruthy()
  })
})
