import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RealtimeGateway } from '../realtime/realtime.gateway';
export declare class AggregatorWorker implements OnModuleInit, OnModuleDestroy {
    private redisService;
    private prismaService;
    private configService;
    private readonly realtimeGateway;
    private readonly logger;
    private isRunning;
    private readonly groupName;
    private readonly streamName;
    private readonly consumerName;
    private aggregationBuffer;
    private flushInterval;
    constructor(redisService: RedisService, prismaService: PrismaService, configService: ConfigService, realtimeGateway: RealtimeGateway);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    private setupConsumerGroup;
    private startConsumerLoop;
    private parseHardwareString;
    private bufferData;
    private startAggregationFlush;
    private flush;
    private aggregateRecords;
    private persistToDb;
}
