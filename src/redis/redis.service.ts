import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private client: Redis;
    private readonly streamName: string;

    constructor(private configService: ConfigService) {
        this.streamName = this.configService.get<string>('REDIS_STREAM_NAME', 'vatio:telemetry:stream');
    }

    private isConnected = false;

    onModuleInit() {
        this.client = new Redis({
            host: this.configService.get<string>('REDIS_HOST', 'localhost'),
            port: this.configService.get<number>('REDIS_PORT', 6379),
            maxRetriesPerRequest: 3, // Prevent infinite retries if server is down
        });

        this.client.on('connect', () => {
            this.isConnected = true;
            console.log('Successfully connected to Redis');
        });

        this.client.on('error', (err) => {
            this.isConnected = false;
            console.error('Redis Error:', err.message);
        });
    }

    onModuleDestroy() {
        this.client.disconnect();
    }

    getIsConnected(): boolean {
        return this.isConnected;
    }

    async addToStream(data: any, topic?: string) {
        const payload = JSON.stringify(data);
        const args: (string | number)[] = [this.streamName, 'MAXLEN', '~', 100000, '*', 'data', payload];
        if (topic) {
            args.push('topic', topic);
        }
        await (this.client as any).xadd(...args);
    }

    async setStatus(deviceId: string, status: string, ttl: number = 30) {
        await this.client.set(`vatio:device:${deviceId}:status`, status, 'EX', ttl);
    }

    async getStatus(deviceId: string): Promise<string> {
        return (await this.client.get(`vatio:device:${deviceId}:status`)) || 'offline';
    }

    getClient(): Redis {
        return this.client;
    }
}
