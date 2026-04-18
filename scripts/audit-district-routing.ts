/**
 * Debug district spelling / routing: compare User.district vs Case.district for a catchment.
 *
 * Usage (from backend folder, DATABASE_URL in .env):
 *   npx tsx scripts/audit-district-routing.ts
 *   npx tsx scripts/audit-district-routing.ts Musanze
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const needle = (process.argv[2] ?? '').trim();

  const hcUsers = await prisma.user.findMany({
    where: { role: 'HEALTH_CENTER' },
    select: { email: true, name: true, district: true },
    orderBy: { district: 'asc' },
  });

  console.log('--- HEALTH_CENTER users (district on account) ---');
  for (const u of hcUsers) {
    console.log(`${u.district.padEnd(24)} | ${u.email} | ${u.name}`);
  }

  const caseDistricts = await prisma.case.groupBy({
    by: ['district'],
    _count: { id: true },
    orderBy: { district: 'asc' },
  });

  console.log('\n--- Cases: distinct district values (counts) ---');
  for (const row of caseDistricts) {
    if (
      !needle ||
      row.district.toLowerCase().includes(needle.toLowerCase())
    ) {
      console.log(`${row.district.padEnd(24)} | ${row._count.id} cases`);
    }
  }

  if (needle) {
    const casesSample = await prisma.case.findMany({
      where: {
        district: { contains: needle, mode: 'insensitive' },
      },
      select: {
        caseRef: true,
        district: true,
        status: true,
        chwPrimaryReferral: true,
        symptomCount: true,
        province: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    console.log(
      `\n--- Last 15 cases where district contains "${needle}" (case-sensitive stored value) ---`
    );
    for (const c of casesSample) {
      console.log(
        `${c.caseRef} | dist="${c.district}" | prov=${c.province} | ${c.status} | referral=${c.chwPrimaryReferral} | symptoms=${c.symptomCount}`
      );
    }
  }

  console.log(
    '\nTip: HC list uses case-insensitive equality on User.district vs Case.district. Fix mismatched spellings on the user row or normalize case data.'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
