/**
 * Creates (or resets) a Health Center user in Ruhango district.
 *
 * Usage (from backend folder):
 *   npm run db:create-hc-ruhango
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLAIN_PASSWORD = 'HcRuhango2026!';
const EMAIL = 'hc.ruhango@malaria-demo.local';

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash(PLAIN_PASSWORD, rounds);

  await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      name: 'Ruhango Health Center',
      role: 'HEALTH_CENTER',
      district: 'Ruhango',
      staffCode: 'HC-RUHANGO-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
    create: {
      email: EMAIL,
      passwordHash,
      name: 'Ruhango Health Center',
      role: 'HEALTH_CENTER',
      district: 'Ruhango',
      staffCode: 'HC-RUHANGO-01',
      status: 'ACTIVE',
      emailVerified: true,
      mustChangePassword: false,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`OK: ${EMAIL} (HEALTH_CENTER, Ruhango)`);
  // eslint-disable-next-line no-console
  console.log(`Password: ${PLAIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
