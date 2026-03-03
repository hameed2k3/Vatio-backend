const mqtt = require('mqtt');

const MQTT_HOST = 'test.enarxi.com';
const topic = 'Meter_Reading';
const client = mqtt.connect(`mqtt://${MQTT_HOST}:1883`);

client.on('connect', () => {
    console.log(`Connected to broker at ${MQTT_HOST}`);

    // Format from .ino: "[0 : val, 16 : val, 32 : val, 51 : val, 44 : val]"
    const payload = '[0 : 1234.56, 16 : 230.5, 32 : 1.2, 51 : 250.0, 44 : 50.0]';

    console.log(`Publishing mock hardware data to ${topic}...`);
    client.publish(topic, payload, { qos: 0 }, (err) => {
        if (err) console.error('Publish failed:', err);
        else console.log('Mock hardware data published successfully.');
        client.end();
    });
});

client.on('error', (err) => {
    console.error('MQTT Error:', err);
});
