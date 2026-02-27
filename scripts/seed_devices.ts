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
    console.log('Seeding initial devices...');

    const devices = [
        { id: 'vatio_device_001', name: 'Device-1', type: 'AC', location: 'Hall' },
        { id: 'vatio_device_002', name: 'Device-2', type: 'AC', location: 'Room' },
        { id: 'vatio_device_003', name: 'Device-3', type: 'DC', location: 'Kitchen' },
    ];

    for (const device of devices) {
        await prisma.device.upsert({
            where: { id: device.id },
            update: device,
            create: device,
        });
        console.log(`Upserted device: ${device.id}`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
