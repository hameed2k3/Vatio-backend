"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkData() {
    const latest = await prisma.telemetry.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' },
    });
    console.log('Latest Telemetry Records:');
    console.log(JSON.stringify(latest, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    await prisma.$disconnect();
}
checkData();
//# sourceMappingURL=check_db.js.map