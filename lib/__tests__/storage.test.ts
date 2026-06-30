import { describe, expect, it, vi, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
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

const IS_WINDOWS = process.platform === 'win32'
const ORIGINAL_STORAGE_PATH = process.env.STORAGE_PATH
const WINDOWS_OVERRIDE_DIR = path.join(
  process.cwd(),
  `.storage-test-${process.pid}-${Date.now()}`
)

// The STORAGE_PATH constant in lib/storage.ts is captured at import time, so
// changing process.env at runtime has no effect on the existing module. This
// block exercises the documented Windows dev override by re-importing storage
// with STORAGE_PATH set to a tmp directory. Skipped on POSIX because the
// default /app/storage override is a Windows-specific concern and the script
// must not pollute POSIX runners' working trees.
describe.skipIf(!IS_WINDOWS)('STORAGE_PATH=./storage override (Windows dev)', () => {
  afterAll(() => {
    if (ORIGINAL_STORAGE_PATH === undefined) {
      delete process.env.STORAGE_PATH
    } else {
      process.env.STORAGE_PATH = ORIGINAL_STORAGE_PATH
    }
    fs.rmSync(WINDOWS_OVERRIDE_DIR, { recursive: true, force: true })
    vi.resetModules()
  })

  it('round-trips a file under the override path and reads it back', async () => {
    process.env.STORAGE_PATH = WINDOWS_OVERRIDE_DIR
    vi.resetModules()
    const storage = await import('../storage')

    expect(storage.getStoragePath()).toBe(WINDOWS_OVERRIDE_DIR)

    const relPath = `roundtrip-${Date.now()}.bin`
    const payload = Buffer.from('kuwenta-storage-windows-override', 'utf8')
    const writtenAbsPath = await storage.writeFile(relPath, payload)
    expect(fs.existsSync(writtenAbsPath)).toBe(true)
    expect(writtenAbsPath).toBe(path.join(WINDOWS_OVERRIDE_DIR, relPath))

    const readBack = await storage.readFile(relPath)
    expect(readBack.equals(payload)).toBe(true)

    expect(storage.fileExists(relPath)).toBe(true)
  })

  it('checkStorageHealth reports the override path as writable', async () => {
    process.env.STORAGE_PATH = WINDOWS_OVERRIDE_DIR
    vi.resetModules()
    const storage = await import('../storage')
    const health = await storage.checkStorageHealth()
    expect(health.path).toBe(WINDOWS_OVERRIDE_DIR)
    expect(health.ok).toBe(true)
    expect(health.writable).toBe(true)
  })
})
