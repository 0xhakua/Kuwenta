/**
 * Ensure the test database exists and is migrated.
 *
 * This script connects to the default `postgres` maintenance database,
 * creates `kuwenta_test` if it does not exist, then runs `prisma migrate deploy`
 * against the test database.
 */
import { PrismaClient } from '@prisma/client'
import { execSync } from 'node:child_process'
import { config } from 'dotenv'

config({ path: '.env.test' })

const testDatabaseUrl = process.env.DATABASE_URL
if (!testDatabaseUrl) {
  throw new Error('DATABASE_URL is not set in .env.test')
}

const maintenanceUrl = testDatabaseUrl.replace(/\/[^/]*$/, '/postgres')

async function ensureDatabase() {
  const prisma = new PrismaClient({
    datasources: { db: { url: maintenanceUrl } },
  })

  try {
    await prisma.$executeRawUnsafe('CREATE DATABASE kuwenta_test')
    console.log('Created database kuwenta_test')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2010' &&
        'meta' in error && (error as { meta?: { code?: string } }).meta?.code === '42P04') ||
      message.includes('already exists')
    ) {
      console.log('Database kuwenta_test already exists')
    } else {
      throw error
    }
  } finally {
    await prisma.$disconnect()
  }
}

async function migrateDatabase() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  })
}

async function main() {
  await ensureDatabase()
  await migrateDatabase()
  console.log('Test database ready.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
