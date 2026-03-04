import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private configService;
    private client;
    private readonly streamName;
    constructor(configService: ConfigService);
    private isConnected;
    onModuleInit(): void;
    onModuleDestroy(): void;
    getIsConnected(): boolean;
    pushToQueue(data: any, topic?: string): Promise<void>;
    setStatus(deviceId: string, status: string, ttl?: number): Promise<void>;
    getStatus(deviceId: string): Promise<string>;
    getClient(): Redis;
}
