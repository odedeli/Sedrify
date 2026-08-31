import { describe, it, expect } from 'vitest'
import { FOUNDATION_VERSION } from '../index'

// Sprint 0 — Scaffold verification test.
// This test confirms the Foundation module loads correctly.
// It will be replaced by real tests in Sprint F-1.

describe('Foundation scaffold', () => {
  it('exports FOUNDATION_VERSION', () => {
    expect(FOUNDATION_VERSION).toBe('0.0.1')
  })

  it('is importable without errors', () => {
    expect(typeof FOUNDATION_VERSION).toBe('string')
  })
})
