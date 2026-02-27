const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

async function main() {
    console.log('DATABASE_URL from process.env:', process.env.DATABASE_URL ? 'FOUND' : 'MISSING');

    try {
        console.log('Attempting Adapter-pg initialization...');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        const prisma = new PrismaClient({ adapter });
        await prisma.$connect();
        console.log('Initialization SUCCESS');
        await prisma.$disconnect();
        await pool.end();
    } catch (error) {
        console.error('Initialization FAILED:', error);
    }
}

main();
