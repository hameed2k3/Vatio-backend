import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const devices = await prisma.device.findMany();
    console.log('Successfully fetched devices:', devices.length);
    if (devices.length > 0) {
      console.log('Sample device keys:', Object.keys(devices[0]));
    }
  } catch (error) {
    console.error('Error fetching devices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
