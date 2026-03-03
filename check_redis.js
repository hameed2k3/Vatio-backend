const Redis = require('ioredis');

async function getRedisInfo() {
    const redis = new Redis({
        host: 'localhost',
        port: 6379,
    });

    try {
        console.log('Connecting to Redis...');
        const streamName = 'vatio:telemetry:stream';
        const streamLen = await redis.xlen(streamName).catch(() => 0);
        const keys = await redis.keys('*');
        const memory = await redis.info('memory');

        // Find used_memory_human in the info string
        const usedMemMatch = memory.match(/used_memory_human:(\S+)/);
        const usedPeakMatch = memory.match(/used_memory_peak_human:(\S+)/);

        console.log('\n--- VATIO REDIS DATA SUMMARY ---');
        console.log(`Connection Status:  CONNECTED`);
        console.log(`Total Keys:         ${keys.length}`);
        console.log(`Stream Name:        ${streamName}`);
        console.log(`Stream Length:      ${streamLen} messages`);
        console.log(`Used Memory:        ${usedMemMatch ? usedMemMatch[1] : 'Unknown'}`);
        console.log(`Peak Memory:        ${usedPeakMatch ? usedPeakMatch[1] : 'Unknown'}`);
        console.log('-------------------------------\n');

        if (keys.length > 0) {
            console.log('Keys present:');
            keys.forEach(k => console.log(` - ${k}`));
        }

    } catch (err) {
        console.error('Error connecting to Redis:', err.message);
    } finally {
        redis.disconnect();
    }
}

getRedisInfo();
