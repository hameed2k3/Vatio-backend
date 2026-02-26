import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RedisService } from '../redis/redis.service';

@Controller()
export class IngestionController {
    constructor(private readonly redisService: RedisService) { }

    @MessagePattern('vatio/telemetry/#')
    async handleTelemetry(@Payload() data: any) {
        // Pipe directly to Redis Stream for sub-millisecond ingestion
        await this.redisService.addToStream(data);
    }
}
