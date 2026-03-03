import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
export declare class TelemetryService {
    private readonly prismaService;
    private readonly redisService;
    constructor(prismaService: PrismaService, redisService: RedisService);
    getHistory(deviceId: string, points?: number, startTime?: Date, endTime?: Date): Promise<any>;
    getAggregatedHistory(deviceId: string, startTime: Date, endTime: Date): Promise<any>;
    getLatest(deviceId: string): Promise<any>;
    getLatestFromRedis(deviceId: string): Promise<any>;
}
