"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const connectionString = process.env.DATABASE_URL;
async function main() {
    console.log('--- Setting up TimescaleDB Hypertable (Native PG Client) ---');
    const client = new pg_1.Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to database.');
        console.log('Enabling TimescaleDB extension...');
        await client.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);
        console.log('Extension enabled.');
        console.log('Converting Telemetry to Hypertable...');
        await client.query(`SELECT create_hypertable('"Telemetry"', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE);`);
        console.log('Telemetry table is now a hypertable!');
        console.log('TimescaleDB setup complete.');
    }
    catch (error) {
        if (error.message.includes('already a hypertable')) {
            console.log('Telemetry table is already a hypertable.');
        }
        else {
            console.error('Error setting up TimescaleDB:', error);
        }
    }
    finally {
        await client.end();
    }
}
main();
//# sourceMappingURL=setup_timescaledb.js.map