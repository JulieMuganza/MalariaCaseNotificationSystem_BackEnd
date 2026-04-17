/**
 * One-off: delete a user by email (clears case reporter FK first). Run: npx tsx scripts/delete-user-by-email.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error('Usage: npx tsx scripts/delete-user-by-email.ts <email>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('No user found with email:', email);
    return;
  }

  await prisma.case.updateMany({
    where: { reportedByUserId: user.id },
    data: { reportedByUserId: null },
  });

  await prisma.notification.updateMany({
    where: { userId: user.id },
    data: { userId: null },
  });

  await prisma.user.delete({ where: { id: user.id } });
  console.log('Deleted user:', email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
