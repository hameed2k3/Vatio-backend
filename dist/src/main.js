"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const microservices_1 = require("@nestjs/microservices");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const frontendUrl = process.env.FRONTEND_URL;
    if (frontendUrl) {
        app.enableCors({
            origin: frontendUrl.split(','),
            credentials: true,
        });
    }
    else {
        app.enableCors();
    }
    const mqttHost = process.env.MQTT_HOST || 'localhost';
    const mqttPort = process.env.MQTT_PORT || 1883;
    app.connectMicroservice({
        transport: microservices_1.Transport.MQTT,
        options: {
            url: `mqtt://${mqttHost}:${mqttPort}`,
            clientId: process.env.MQTT_CLIENT_ID || 'vatio_backend_service',
        },
    });
    await app.startAllMicroservices();
    await app.listen(process.env.PORT || 3000, '0.0.0.0');
    console.log(`VATIO Backend is running on: ${await app.getUrl()}`);
    console.log(`MQTT Ingestion connected to: mqtt://${mqttHost}:${mqttPort}`);
}
bootstrap();
//# sourceMappingURL=main.js.map