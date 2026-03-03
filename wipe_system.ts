import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

async function wipe() {
    console.log('--- Starting System Wipe ---');

    try {
        // 1. Clear Database
        console.log('Wiping Telemetry table...');
        await prisma.$executeRawUnsafe('TRUNCATE TABLE "Telemetry" CASCADE');

        console.log('Wiping Device table...');
        await prisma.$executeRawUnsafe('TRUNCATE TABLE "Device" CASCADE');

        console.log('PostgreSQL Database cleared successfully.');

        // 2. Clear Redis
        const redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
        });

        console.log('Flushing Redis cache...');
        await redis.flushall();
        console.log('Redis cleared successfully.');

        await redis.quit();
    } catch (error) {
        console.error('Wipe failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }

    console.log('--- Wipe Complete. System is Fresh! ---');
}

wipe();
