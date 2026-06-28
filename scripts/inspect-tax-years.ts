import { prisma } from '../lib/prisma'

async function main() {
  const taxYears = await prisma.taxYear.findMany({
    include: { returns: true },
  })
  console.log(JSON.stringify(taxYears, null, 2))
  await prisma.$disconnect()
}

main()
