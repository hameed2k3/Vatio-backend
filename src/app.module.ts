import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { AggregatorModule } from './aggregator/aggregator.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: { target: 'pino-pretty' },
      },
    }),
    PrismaModule,
    RedisModule,
    RealtimeModule,
    IngestionModule,
    AggregatorModule,
    TelemetryModule,
    AuthModule,
  ],
})
export class AppModule { }
