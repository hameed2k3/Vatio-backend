import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL is not set in environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedSingleDevice() {
  const deviceId = 'vatio_test_device_002';
  const ownerEmail = 'admin@vatio.io';
  console.log(`Seeding device: ${deviceId}`);
  console.log(`Using owner email: ${ownerEmail}`);

  try {
    // 1. Ensure a user exists to be the owner
    console.log('Attempting to find user via RAW query...');
    const users: any[] = await prisma.$queryRaw`SELECT id FROM "User" WHERE email = ${ownerEmail} LIMIT 1`;
    let user = users[0];

    if (!user) {
      console.log(`Creating owner user: ${ownerEmail}`);
      // Using raw insert to be safe
      const newUserId = require('crypto').randomUUID();
      await prisma.$executeRaw`INSERT INTO "User" (id, email, password, name, role) VALUES (${newUserId}, ${ownerEmail}, 'password123', 'Admin User', 'admin')`;
      user = { id: newUserId };
    }

    console.log(`User found/created: ${user.id}`);

    // 2. Upsert the device with the owner
    console.log('Attempting to upsert device...');
    const device = await prisma.device.upsert({
      where: { id: deviceId },
      update: {},
      create: {
        id: deviceId,
        name: 'Test Device 002',
        type: 'SmartMeter',
        location: 'Lab-A',
        owner: {
          connect: { id: user.id }
        }
      }
    });

    console.log('Successfully seeded device:', device);
  } catch (err: any) {
    console.error('Seed error (general):', err.message || err);
    if (err.stack) console.error(err.stack);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seedSingleDevice();
