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
    console.log('--- FINAL CLEANUP: Removing Devices 2 & 3 ---');

    const deviceIdsToRemove = ['vatio_device_002', 'vatio_device_003'];

    try {
        // Delete associated Telemetry first
        const teleDeleted = await (prisma as any).telemetry.deleteMany({
            where: {
                deviceId: { in: deviceIdsToRemove }
            }
        });
        console.log(`Deleted ${teleDeleted.count} telemetry records.`);

        // Delete the Devices
        const devDeleted = await (prisma as any).device.deleteMany({
            where: {
                id: { in: deviceIdsToRemove }
            }
        });
        console.log(`Deleted ${devDeleted.count} device records.`);

        console.log('Cleanup successful.');
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
