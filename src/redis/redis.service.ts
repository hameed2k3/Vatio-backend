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

    async addToStream(data: any) {
        const payload = JSON.stringify(data);
        await this.client.xadd(this.streamName, 'MAXLEN', '~', 100000, '*', 'data', payload);
    }

    getClient(): Redis {
        return this.client;
    }
}
