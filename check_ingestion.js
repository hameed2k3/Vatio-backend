const Redis = require('ioredis');

async function checkIngestion() {
    const redis = new Redis({
        host: 'localhost',
        port: 6379,
    });

    try {
        const streamName = 'vatio:telemetry:stream';
        const len = await redis.xlen(streamName);
        console.log(`Current length of ${streamName}: ${len}`);

        if (len > 0) {
            const last = await redis.xrevrange(streamName, '+', '-', 'COUNT', 1);
            console.log('Latest message in stream:');
            console.log(JSON.stringify(last, null, 2));
        } else {
            console.log('No messages found in the stream.');
        }

        const keys = await redis.keys('vatio:latest:*');
        console.log(`Latest cache keys: ${keys.join(', ')}`);

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await redis.quit();
    }
}

checkIngestion();
