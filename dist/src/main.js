"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const app_module_1 = require("./app.module");
const microservices_1 = require("@nestjs/microservices");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter({ logger: true }));
    app.enableCors();
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('Vatio IoT API')
        .setDescription('Professional API for Vatio Infrastructure')
        .setVersion('2.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
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
    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 VATIO Backend is running on: http://localhost:${port}`);
    console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map