import { beforeEach } from 'vitest'
import { resetDatabase } from './lib/testing/db'

beforeEach(async () => {
  await resetDatabase()
})
