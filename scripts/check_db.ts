import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
    const latest = await prisma.telemetry.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' },
    });
    console.log('Latest Telemetry Records:');
    console.log(JSON.stringify(latest, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));
    await prisma.$disconnect();
}

checkData();
