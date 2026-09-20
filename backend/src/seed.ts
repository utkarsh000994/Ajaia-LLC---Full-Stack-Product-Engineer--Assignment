import 'dotenv/config';
import { prisma } from './lib/prisma.js';

async function main() {
  const users = [
    { name: 'Utkarsh Kumar', email: 'utkarsh@example.com' },
    { name: 'Demo Reviewer', email: 'reviewer@example.com' },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }

  console.log('Seeded demo users');
}

main().finally(async () => {
  await prisma.$disconnect();
});
