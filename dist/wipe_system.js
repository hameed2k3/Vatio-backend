"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ioredis_1 = __importDefault(require("ioredis"));
const prisma = new client_1.PrismaClient();
async function wipe() {
    console.log('--- Starting System Wipe ---');
    try {
        console.log('Wiping Telemetry table...');
        await prisma.$executeRawUnsafe('TRUNCATE TABLE "Telemetry" CASCADE');
        console.log('Wiping Device table...');
        await prisma.$executeRawUnsafe('TRUNCATE TABLE "Device" CASCADE');
        console.log('PostgreSQL Database cleared successfully.');
        const redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
        });
        console.log('Flushing Redis cache...');
        await redis.flushall();
        console.log('Redis cleared successfully.');
        await redis.quit();
    }
    catch (error) {
        console.error('Wipe failed:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
    console.log('--- Wipe Complete. System is Fresh! ---');
}
wipe();
//# sourceMappingURL=wipe_system.js.map