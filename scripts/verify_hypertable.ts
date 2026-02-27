import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

async function main() {
    console.log('--- Verifying Hypertable Status ---');
    const client = new Client({
        connectionString,
        ssl: true // Required for Neon
    });

    try {
        await client.connect();
        const res = await client.query(`SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'Telemetry';`);
        if (res.rows.length > 0) {
            console.log('SUCCESS: Telemetry table IS a TimescaleDB Hypertable!');
            console.log(JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log('FAILURE: Telemetry table is NOT a hypertable.');

            // Attempt one last time with simple SQL if it failed before
            console.log('Attempting conversion one last time...');
            await client.query(`SELECT create_hypertable('"Telemetry"', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE);`);
            console.log('Conversion attempt finished.');
        }
    } catch (error) {
        console.error('Error verifying hypertable:', error);
    } finally {
        await client.end();
    }
}

main();
