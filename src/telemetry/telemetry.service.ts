import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TelemetryService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly redisService: RedisService,
    ) { }

    async getHistory(deviceId: string, points?: number, startTime?: Date, endTime?: Date) {
        const where: any = { deviceId };
        const takeLimit = points || 20000;

        if (startTime || endTime) {
            where.timestamp = {};
            if (startTime) where.timestamp.gte = startTime;
            if (endTime) where.timestamp.lte = endTime;
        }

        return (this.prismaService as any).telemetry.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: takeLimit,
        });
    }

    async getAggregatedHistory(deviceId: string, startTime: Date, endTime: Date) {
        // Choose aggregation bucket based on range size
        const rangeMs = endTime.getTime() - startTime.getTime();
        const rangeHours = rangeMs / (1000 * 60 * 60);

        let bucket: string;
        let limit: number;
        if (rangeHours <= 2) {
            bucket = 'minute';    // 1h/2h → per-minute
            limit = 500;
        } else if (rangeHours <= 48) {
            bucket = 'hour';      // 24h → per-hour (24 pts)
            limit = 200;
        } else if (rangeHours <= 24 * 60) {
            bucket = 'day';       // 30 days → per-day (30 pts)
            limit = 100;
        } else {
            bucket = 'month';     // 12 months → per-month (12 pts)
            limit = 50;
        }

        // Using $queryRawUnsafe because date_trunc needs the bucket as a SQL keyword, 
        // not a parameterized string value. Bucket is whitelist-validated above (safe).
        return (this.prismaService as any).$queryRawUnsafe(
            `SELECT 
                date_trunc('${bucket}', timestamp) as "timestamp",
                AVG(voltage) as "voltage",
                AVG(current) as "current",
                AVG(power) as "power",
                MAX(energy) as "energy",
                AVG(frequency) as "frequency"
            FROM "Telemetry"
            WHERE "deviceId" = $1 
              AND "timestamp" >= $2 
              AND "timestamp" <= $3
            GROUP BY date_trunc('${bucket}', timestamp)
            ORDER BY "timestamp" ASC
            LIMIT ${limit}`,
            deviceId,
            startTime,
            endTime,
        );
    }

    async getLatest(deviceId: string) {
        return (this.prismaService as any).telemetry.findFirst({
            where: { deviceId },
            orderBy: { timestamp: 'desc' },
        });
    }

    async getLatestFromRedis(deviceId: string) {
        const data = await this.redisService.getClient().get(`vatio:latest:${deviceId}`);
        return data ? JSON.parse(data) : null;
    }
}
