import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();
  const email = 'admin@vatio.io';
  const password = 'password';
  
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log('Admin user already exists.');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'System Admin',
        role: 'admin'
      }
    });
    console.log('Successfully created admin user: admin@vatio.io / password');
  } catch (error) {
    console.error('Error seeding admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
