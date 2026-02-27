import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

async function main() {
    console.log('--- Setting up TimescaleDB Hypertable (Native PG Client) ---');
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('Connected to database.');

        // 1. Enable extension
        console.log('Enabling TimescaleDB extension...');
        await client.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);
        console.log('Extension enabled.');

        // 2. Convert Telemetry to hypertable
        console.log('Converting Telemetry to Hypertable...');
        // We use the public schema and quote the table name correctly
        await client.query(`SELECT create_hypertable('"Telemetry"', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE);`);
        console.log('Telemetry table is now a hypertable!');

        // 3. Optional: Add a continuous aggregation policy or extra indexes if needed
        // For now, standard hypertable partitioning is a huge win.

        console.log('TimescaleDB setup complete.');
    } catch (error) {
        if (error.message.includes('already a hypertable')) {
            console.log('Telemetry table is already a hypertable.');
        } else {
            console.error('Error setting up TimescaleDB:', error);
        }
    } finally {
        await client.end();
    }
}

main();
