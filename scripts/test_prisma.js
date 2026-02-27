const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function main() {
    console.log('DATABASE_URL from process.env:', process.env.DATABASE_URL ? 'FOUND' : 'MISSING');

    try {
        console.log('Attempting standard initialization...');
        const prisma = new PrismaClient();
        await prisma.$connect();
        console.log('Standard initialization SUCCESS');
        await prisma.$disconnect();
    } catch (error) {
        console.error('Standard initialization FAILED:', error.message);
    }

    try {
        console.log('\nAttempting with datasourceUrl property...');
        const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
        await prisma.$connect();
        console.log('datasourceUrl initialization SUCCESS');
        await prisma.$disconnect();
    } catch (error) {
        console.error('datasourceUrl initialization FAILED:', error.message);
    }
}

main();
