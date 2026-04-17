/**
 * Creates (or resets) a demo CHW account with a fixed password.
 * Safe to re-run: upserts by email.
 *
 * Usage (from backend folder):
 *   npm run db:create-chw-demo
 *   npx tsx scripts/create-chw-demo-user.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Default password for this demo user (change in production). */
const PLAIN_PASSWORD = 'ChwDemo2026!';

const EMAIL = 'chw.demo@malaria-demo.local';

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash(PLAIN_PASSWORD, rounds);

  await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      name: 'Demo CHW Field Worker',
      role: 'CHW',
      district: 'Huye',
      staffCode: 'CHW-DEMO-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
    create: {
      email: EMAIL,
      passwordHash,
      name: 'Demo CHW Field Worker',
      role: 'CHW',
      district: 'Huye',
      staffCode: 'CHW-DEMO-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`OK: ${EMAIL} (CHW) — password is in script constant PLAIN_PASSWORD`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
