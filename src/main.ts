import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    app.enableCors({
      origin: frontendUrl.split(','),
      credentials: true,
    });
  } else {
    app.enableCors();
  }

  const mqttHost = process.env.MQTT_HOST;
  const mqttPort = process.env.MQTT_PORT || 1883;

  // Only connect MQTT if MQTT_HOST is explicitly set
  if (mqttHost) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.MQTT,
      options: {
        url: `mqtt://${mqttHost}:${mqttPort}`,
        clientId: process.env.MQTT_CLIENT_ID || 'vatio_backend_service',
      },
    });
    await app.startAllMicroservices();
    console.log(`MQTT Ingestion connected to: mqtt://${mqttHost}:${mqttPort}`);
  } else {
    console.log('MQTT_HOST not set — MQTT ingestion disabled. Use Redis-based simulation instead.');
  }

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log(`VATIO Backend is running on: ${await app.getUrl()}`);
}
bootstrap();
