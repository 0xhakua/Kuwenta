import fs from 'fs'
import path from 'path'

const STORAGE_PATH = process.env.STORAGE_PATH ?? '/app/storage'
const STORAGE_TYPE = process.env.STORAGE_TYPE ?? 'local'

export function getStoragePath(): string {
  return STORAGE_PATH
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
