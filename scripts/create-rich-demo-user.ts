/**
 * Creates (or resets) a demo RICH (surveillance) account with a fixed password.
 * Upserts only this email — does not delete or modify other users.
 *
 * Usage (from backend folder):
 *   npm run db:create-rich-demo
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLAIN_PASSWORD = 'RichDemo2026!';

const EMAIL = 'rich.demo@malaria-demo.local';

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash(PLAIN_PASSWORD, rounds);

  await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      name: 'Demo RICH Surveillance',
      role: 'RICH',
      district: 'Huye',
      staffCode: 'RICH-DEMO-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
    create: {
      email: EMAIL,
      passwordHash,
      name: 'Demo RICH Surveillance',
      role: 'RICH',
      district: 'Huye',
      staffCode: 'RICH-DEMO-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`OK: ${EMAIL} (RICH)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
