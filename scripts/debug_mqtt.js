const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://test.enarxi.com:1883');

client.on('connect', () => {
    console.log('Connected to MQTT Broker');
    client.subscribe(['#'], (err) => {
        if (!err) {
            console.log('Subscribed to ALL topics (#)');
        }
    });
});

client.on('message', (topic, message) => {
    console.log(`Topic: ${topic}`);
    console.log(`Message: ${message.toString()}`);
});

client.on('error', (err) => {
    console.error('MQTT Error:', err);
});
