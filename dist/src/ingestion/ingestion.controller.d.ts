import { RedisService } from '../redis/redis.service';
export declare class IngestionController {
    private readonly redisService;
    constructor(redisService: RedisService);
    handleTelemetry(data: any): Promise<void>;
}
