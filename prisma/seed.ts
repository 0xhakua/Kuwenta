import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma'
import { initializeTaxYear } from '../lib/tax-year'

async function main() {
  // Admin user
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin1234!'
  const passwordHash = await bcrypt.hash(adminPassword, 12)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      role: 'ADMIN',
    },
  })

  // Test taxpayers
  const testUsers = [
    {
      username: 'maria',
      password: 'Test1234!',
      profile: {
        tin: '123-456-789-0001',
        fullName: 'Maria Dela Cruz',
        rdoCode: '040',
        registeredAddress: '123 Mabini St, Makati City',
        zipCode: '1200',
        natureOfBusiness: 'Insurance Agent / Freelance Broker',
        incomeType: 'PURE_SELF_EMPLOYMENT' as const,
        corIncludes2551Q: true,
        atcCodes: ['WI071', 'WI140'],
        taxYear: 2026,
      },
    },
    {
      username: 'juan',
      password: 'Test1234!',
      profile: {
        tin: '123-456-789-0002',
        fullName: 'Juan Santos',
        rdoCode: '044',
        registeredAddress: '456 Rizal Ave, Quezon City',
        zipCode: '1100',
        natureOfBusiness: 'Software Consultant',
        incomeType: 'MIXED_INCOME' as const,
        corIncludes2551Q: true,
        atcCodes: ['WI100'],
        taxYear: 2026,
      },
    },
    {
      username: 'anna',
      password: 'Test1234!',
      profile: {
        tin: '123-456-789-0003',
        fullName: 'Anna Reyes',
        rdoCode: '050',
        registeredAddress: '789 Bonifacio St, Pasig City',
        zipCode: '1600',
        natureOfBusiness: 'Virtual Assistant',
        incomeType: 'PURE_SELF_EMPLOYMENT' as const,
        corIncludes2551Q: false,
        atcCodes: ['WI100'],
        taxYear: 2026,
      },
    },
  ]

  for (const user of testUsers) {
    const hashed = await bcrypt.hash(user.password, 12)
    const createdUser = await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: {
        username: user.username,
        passwordHash: hashed,
        role: 'TAXPAYER',
      },
    })

    const existingProfile = await prisma.taxpayerProfile.findUnique({
      where: { userId: createdUser.id },
    })

    if (!existingProfile) {
      const { atcCodes: profileAtcCodes, taxYear, ...profileData } = user.profile
      const profile = await prisma.taxpayerProfile.create({
        data: {
          userId: createdUser.id,
          ...profileData,
        },
      })

      await prisma.taxpayerATC.createMany({
        data: profileAtcCodes.map((code) => ({
          taxpayerId: profile.id,
          atcCode: code,
        })),
      })

      const holidays = await prisma.publicHoliday.findMany({
        where: { year: taxYear },
      })

      await initializeTaxYear(
        profile.id,
        taxYear,
        profileData.corIncludes2551Q,
        holidays.map((h) => h.date)
      )
    }
  }

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
