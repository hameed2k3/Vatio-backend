import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private configService;
    private client;
    private readonly streamName;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    addToStream(data: any): Promise<void>;
    getClient(): Redis;
}
