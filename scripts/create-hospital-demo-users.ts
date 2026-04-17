/**
 * Creates two demo accounts: District Hospital + Referral Hospital.
 * Safe to re-run: upserts by email.
 *
 * Usage (from backend folder):
 *   npx tsx scripts/create-hospital-demo-users.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLAIN_PASSWORD = 'SmcnHospital2026!';

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash(PLAIN_PASSWORD, rounds);

  const users = [
    {
      email: 'district.clinical@malaria-demo.local',
      name: 'Dr. District Clinical Demo',
      role: 'HOSPITAL' as const,
      staffCode: 'DH-DEMO-01',
    },
    {
      email: 'referral.clinical@malaria-demo.local',
      name: 'Dr. Referral Clinical Demo',
      role: 'REFERRAL_HOSPITAL' as const,
      staffCode: 'RH-DEMO-01',
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        name: u.name,
        role: u.role,
        district: 'Huye',
        staffCode: u.staffCode,
        status: 'ACTIVE',
        emailVerified: true,
        mustChangePassword: false,
      },
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
        district: 'Huye',
        staffCode: u.staffCode,
        status: 'ACTIVE',
        emailVerified: true,
        mustChangePassword: false,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`OK: ${u.email} (${u.role})`);
  }

  // eslint-disable-next-line no-console
  console.log('\nDone. Sign in with the shared demo password (see project docs or script constant PLAIN_PASSWORD).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
