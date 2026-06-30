import { describe, expect, it } from 'vitest'
import { checkStorageHealth, getStoragePath, getStorageType } from '../storage'

describe('checkStorageHealth', () => {
  it('returns a typed result for the configured storage path', async () => {
    const target = getStoragePath()
    const result = await checkStorageHealth()
    expect(result.path).toBe(target)
    expect(typeof result.type).toBe('string')
    expect(typeof result.message).toBe('string')
    // ok/writable are booleans; depending on the test environment the
    // configured path may or may not be writable, so we don't assert.
    expect(typeof result.ok).toBe('boolean')
    expect(typeof result.writable).toBe('boolean')
  })

  it('exposes the configured storage type', () => {
    expect(typeof getStorageType()).toBe('string')
  })
})
