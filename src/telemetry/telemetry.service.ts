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
        return (this.prismaService as any).$queryRaw`
            SELECT 
                date_trunc('minute', timestamp) as "timestamp",
                AVG(voltage) as "voltage",
                AVG(current) as "current",
                AVG(power) as "power",
                MAX(energy) as "energy",
                AVG(frequency) as "frequency"
            FROM "Telemetry"
            WHERE "deviceId" = ${deviceId} 
              AND "timestamp" >= ${startTime} 
              AND "timestamp" <= ${endTime}
            GROUP BY "timestamp"
            ORDER BY "timestamp" DESC
            LIMIT 5000
        `;
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
