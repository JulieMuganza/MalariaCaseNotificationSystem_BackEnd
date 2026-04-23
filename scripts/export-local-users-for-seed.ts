import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_PATH = path.join(__dirname, '..', 'prisma', 'local-users.seed.json');

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      passwordHash: true,
      name: true,
      phone: true,
      role: true,
      district: true,
      status: true,
      staffCode: true,
      emailVerified: true,
      mustChangePassword: true,
    },
    orderBy: { email: 'asc' },
  });

  await fs.writeFile(OUT_PATH, JSON.stringify(users, null, 2), 'utf8');
  console.log(`Exported ${users.length} users to ${OUT_PATH}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
