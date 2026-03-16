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
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const url = process.env.DATABASE_URL;
if (!url) {
    console.error('DATABASE_URL is not set in environment variables');
    process.exit(1);
}
const pool = new pg_1.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
});
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function seedSingleDevice() {
    const deviceId = 'vatio_test_device_002';
    const ownerEmail = 'admin@vatio.io';
    console.log(`Seeding device: ${deviceId}`);
    console.log(`Using owner email: ${ownerEmail}`);
    try {
        console.log('Attempting to find user via RAW query...');
        const users = await prisma.$queryRaw `SELECT id FROM "User" WHERE email = ${ownerEmail} LIMIT 1`;
        let user = users[0];
        if (!user) {
            console.log(`Creating owner user: ${ownerEmail}`);
            const newUserId = require('crypto').randomUUID();
            await prisma.$executeRaw `INSERT INTO "User" (id, email, password, name, role) VALUES (${newUserId}, ${ownerEmail}, 'password123', 'Admin User', 'admin')`;
            user = { id: newUserId };
        }
        console.log(`User found/created: ${user.id}`);
        console.log('Attempting to upsert device...');
        const device = await prisma.device.upsert({
            where: { id: deviceId },
            update: {},
            create: {
                id: deviceId,
                name: 'Test Device 002',
                type: 'SmartMeter',
                location: 'Lab-A',
                owner: {
                    connect: { id: user.id }
                }
            }
        });
        console.log('Successfully seeded device:', device);
    }
    catch (err) {
        console.error('Seed error (general):', err.message || err);
        if (err.stack)
            console.error(err.stack);
    }
    finally {
        await prisma.$disconnect();
        await pool.end();
    }
}
seedSingleDevice();
//# sourceMappingURL=seed_single_device.js.map