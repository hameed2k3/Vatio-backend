import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
    console.log('--- Clearing Database (Device & Telemetry) ---');
    try {
        // Delete Telemetry first due to foreign key constraints
        console.log('Deleting Telemetry records...');
        const teleOutcome = await prisma.telemetry.deleteMany({});
        console.log(`Deleted ${teleOutcome.count} Telemetry records.`);

        // Delete Devices
        console.log('Deleting Device records...');
        const deviceOutcome = await prisma.device.deleteMany({});
        console.log(`Deleted ${deviceOutcome.count} Device records.`);

        console.log('Database cleared successfully.');
    } catch (error) {
        console.error('Error clearing database:', error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
