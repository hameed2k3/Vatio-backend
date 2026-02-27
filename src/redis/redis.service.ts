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

    onModuleInit() {
        this.client = new Redis({
            host: this.configService.get<string>('REDIS_HOST', 'localhost'),
            port: this.configService.get<number>('REDIS_PORT', 6379),
        });
    }

    onModuleDestroy() {
        this.client.disconnect();
    }

    async addToStream(data: any, topic?: string) {
        const payload = JSON.stringify(data);
        const args: (string | number)[] = [this.streamName, 'MAXLEN', '~', 100000, '*', 'data', payload];
        if (topic) {
            args.push('topic', topic);
        }
        await (this.client.xadd as any)(...args);
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
