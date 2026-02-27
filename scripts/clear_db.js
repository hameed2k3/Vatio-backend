const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Clearing Database ---');
    try {
        // Delete Telemetry first due to foreign key constraints
        console.log('Deleting Telemetry records...');
        const teleOutcome = await prisma.telemetry.deleteMany({});
        console.log(`Deleted ${teleOutcome.count} Telemetry records.`);

        // Delete Devices
        console.log('Deleting Device records...');
        const deviceOutcome = await prisma.device.deleteMany({});
        console.log(`Deleted ${deviceOutcome.count} Device records.`);

        console.log('Database cleared successfully.');
    } catch (error) {
        console.error('Error clearing database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
