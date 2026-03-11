import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true })
  );

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Vatio IoT API')
    .setDescription('Professional API for Vatio Infrastructure')
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

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
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 VATIO Backend is running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();
