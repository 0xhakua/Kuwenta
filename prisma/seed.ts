import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // Admin user
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'admin1234!', 12)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      role: 'ADMIN',
    },
  })

  // ATC Codes
  const atcCodes = [
    { code: 'WI071', description: 'Insurance Agents & Adjusters', ewtRate: 0.10 },
    { code: 'WI140', description: "Agent/Broker's Fees", ewtRate: 0.10 },
    { code: 'WI100', description: 'Professional fees — lawyers, CPAs, engineers', ewtRate: 0.10 },
    { code: 'WI160', description: 'Fees of directors who are not employees', ewtRate: 0.15 },
  ]
  for (const atc of atcCodes) {
    await prisma.aTCCode.upsert({
      where: { code: atc.code },
      update: {},
      create: atc,
    })
  }

  // RDO Penalty Schedules (sample)
  const rdoPenalties = [
    { rdoCode: '040', compromiseFee: 500 },
    { rdoCode: '044', compromiseFee: 500 },
    { rdoCode: '050', compromiseFee: 1000 },
  ]
  for (const rdo of rdoPenalties) {
    await prisma.rDOPenaltySchedule.upsert({
      where: { rdoCode: rdo.rdoCode },
      update: {},
      create: rdo,
    })
  }

  console.log('Seed complete.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
