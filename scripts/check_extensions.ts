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
    console.log('--- Checking PostgreSQL Extensions ---');
    try {
        const extensions: any = await prisma.$queryRaw`SELECT extname FROM pg_extension;`;
        console.log('Installed extensions:', extensions);

        const available: any = await prisma.$queryRaw`SELECT name FROM pg_available_extensions WHERE name = 'timescaledb';`;
        if (available.length > 0) {
            console.log('TimescaleDB is AVAILABLE to be installed.');
        } else {
            console.log('TimescaleDB is NOT available in this PostgreSQL environment.');
        }
    } catch (error) {
        console.error('Error checking extensions:', error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
