const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const url = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
    console.log('--- Checking Latest Data ---');
    try {
        const latest = await prisma.telemetry.findMany({
            take: 10,
            orderBy: { timestamp: 'desc' }
        });

        if (latest.length === 0) {
            console.log('No telemetry records found in database.');
            return;
        }

        latest.forEach(l => {
            console.log(`[${l.timestamp.toISOString()}] Energy: ${l.energy}, Power: ${l.power}`);
        });
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

check();
