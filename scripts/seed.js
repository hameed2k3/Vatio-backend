const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const url = process.env.DATABASE_URL;
const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
    console.log('Seeding device: vatio_device_001');
    try {
        await prisma.device.upsert({
            where: { id: 'vatio_device_001' },
            update: {},
            create: {
                id: 'vatio_device_001',
                name: 'Main Meter',
                type: 'Industrial',
                location: 'Site-A'
            }
        });
        console.log('Success.');
    } catch (err) {
        console.error('Seed error:', err);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

seed();
