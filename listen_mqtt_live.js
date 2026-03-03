const mqtt = require('mqtt');

const MQTT_HOST = 'test.enarxi.com';
const topics = ['Meter_Reading', 'test/Meter_Reading'];
const client = mqtt.connect(`mqtt://${MQTT_HOST}:1883`);

console.log(`Connecting to ${MQTT_HOST}...`);

client.on('connect', () => {
    console.log(`Connected to broker at ${MQTT_HOST}`);
    console.log(`Subscribing to topics: ${topics.join(', ')}`);

    client.subscribe(topics, (err) => {
        if (err) {
            console.error('Subscription failed:', err);
        } else {
            console.log('Waiting for live data from hardware (this may take over 60 seconds)...');
        }
    });
});

client.on('message', (topic, message) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[${timestamp}] Incoming message on topic: ${topic}`);
    console.log('Payload:', message.toString());
});

client.on('error', (err) => {
    console.error('MQTT Error:', err);
});

// Auto-exit after 5 minutes
setTimeout(() => {
    console.log('\nMonitoring period finished.');
    client.end();
    process.exit(0);
}, 300000);
