import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    app.enableCors({
      origin: frontendUrl.split(','),
      credentials: true,
    });
  } else {
    app.enableCors(); // Allow all for local dev
  }

  const mqttHost = process.env.MQTT_HOST || 'localhost';
  const mqttPort = process.env.MQTT_PORT || 1883;

  // Hybrid Application: HTTP + MQTT Microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.MQTT,
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
