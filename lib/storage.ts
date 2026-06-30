import fs from 'fs'
import path from 'path'

const STORAGE_PATH = process.env.STORAGE_PATH ?? '/app/storage'
const STORAGE_TYPE = process.env.STORAGE_TYPE ?? 'local'

export function getStoragePath(): string {
  return STORAGE_PATH
}

export function getStorageType(): string {
  return STORAGE_TYPE
}

export async function writeFile(localPath: string, buffer: Buffer): Promise<string> {
  if (STORAGE_TYPE === 'local') {
    const fullPath = path.join(STORAGE_PATH, localPath)
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.promises.writeFile(fullPath, buffer)
    return fullPath
  }

  // Railway Volume also uses the filesystem mount, so the logic is identical
  const fullPath = path.join(STORAGE_PATH, localPath)
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.promises.writeFile(fullPath, buffer)
  return fullPath
}

export async function readFile(localPath: string): Promise<Buffer> {
  const fullPath = path.join(STORAGE_PATH, localPath)
  return fs.promises.readFile(fullPath)
}

export function fileExists(localPath: string): boolean {
  const fullPath = path.join(STORAGE_PATH, localPath)
  return fs.existsSync(fullPath)
}

export interface StorageHealth {
  ok: boolean
  type: string
  path: string
  writable: boolean
  message: string
}

/**
 * Probe the configured storage backend. For the local/Railway filesystem
 * driver we check that the directory is creatable and writable; a tiny temp
 * file is written and removed.
 */
export async function checkStorageHealth(): Promise<StorageHealth> {
  const base: Omit<StorageHealth, 'ok' | 'writable' | 'message'> = {
    type: STORAGE_TYPE,
    path: STORAGE_PATH,
  }
  try {
    await fs.promises.mkdir(STORAGE_PATH, { recursive: true })
    const probe = path.join(STORAGE_PATH, `.kuwenta-health-${process.pid}-${Date.now()}`)
    await fs.promises.writeFile(probe, 'ok')
    await fs.promises.unlink(probe)
    return { ...base, ok: true, writable: true, message: 'Storage is writable' }
  } catch (err) {
    return {
      ...base,
      ok: false,
      writable: false,
      message: err instanceof Error ? err.message : 'Storage is not writable',
    }
  }
}
