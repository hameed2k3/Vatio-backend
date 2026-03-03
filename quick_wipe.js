const { Client } = require('pg');
const Redis = require('ioredis');

async function wipe() {
    console.log('--- Starting System Wipe (Direct) ---');

    // 1. PostgreSQL Wipe
    const dbUrl = "postgresql://neondb_owner:npg_zgqUiMj5Ruw3@ep-floral-sunset-a1cqtomn-pooler.ap-southeast-1.aws.neon.tech/VATIO%20DB?sslmode=require&channel_binding=require";
    const client = new Client({ connectionString: dbUrl });

    try {
        await client.connect();
        console.log('Connected to PostgreSQL.');

        await client.query('TRUNCATE TABLE "Telemetry" CASCADE');
        console.log('Truncated Telemetry table.');

        await client.query('TRUNCATE TABLE "Device" CASCADE');
        console.log('Truncated Device table.');

    } catch (err) {
        console.error('PostgreSQL wipe failed:', err);
    } finally {
        await client.end();
    }

    // 2. Redis Wipe
    const redis = new Redis({
        host: 'localhost',
        port: 6379,
    });

    try {
        console.log('Connecting to Redis...');
        await redis.flushall();
        console.log('Redis flushed successfully.');
    } catch (err) {
        console.error('Redis wipe failed:', err);
    } finally {
        await redis.quit();
    }

    console.log('--- System Wipe Complete ---');
}

wipe();
