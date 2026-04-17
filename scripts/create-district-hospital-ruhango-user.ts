/**
 * Creates (or resets) a District Hospital user scoped to Ruhango district.
 * Safe to re-run: upserts by email.
 *
 * Usage (from backend folder):
 *   npm run db:create-dh-ruhango
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLAIN_PASSWORD = 'DhRuhango2026!';
const EMAIL = 'district.ruhango@malaria-demo.local';

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash(PLAIN_PASSWORD, rounds);

  await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      name: 'Ruhango District Hospital',
      role: 'HOSPITAL',
      district: 'Ruhango',
      staffCode: 'DH-RUHANGO-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
    create: {
      email: EMAIL,
      passwordHash,
      name: 'Ruhango District Hospital',
      role: 'HOSPITAL',
      district: 'Ruhango',
      staffCode: 'DH-RUHANGO-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`OK: ${EMAIL} (HOSPITAL / District Hospital, Ruhango)`);
  // eslint-disable-next-line no-console
  console.log(`Password: ${PLAIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
