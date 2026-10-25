import { prisma } from './config/db.js';
import bcrypt from 'bcryptjs';

async function main() {
  await prisma.transaction.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);

  await prisma.user.create({
    data: {
      username: 'alice',
      password: hashedPassword,
      wallet: { create: { balance: 1000.0 } }
    }
  });

  await prisma.user.create({
    data: {
      username: 'bob',
      password: hashedPassword,
      wallet: { create: { balance: 250.0 } }
    }
  });

  console.log('Database seeded successfully!');
  console.log('User 1: alice (Password: password123, Initial Balance: ₹1,000)');
  console.log('User 2: bob (Password: password123, Initial Balance: ₹250)');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());