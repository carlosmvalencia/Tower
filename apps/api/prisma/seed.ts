import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);

  const adminEmail = 'admin@all-logistics.co';
  const adminPassword = 'Admin123!';
  const passwordHash = await bcrypt.hash(adminPassword, rounds);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'Administrador',
      role: UserRole.ADMIN,
    },
  });

  console.log(`Seed OK — admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
