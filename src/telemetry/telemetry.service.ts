import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TelemetryService {
    constructor(private readonly prismaService: PrismaService) { }

    async getHistory(deviceId: string, points: number = 60, startTime?: Date, endTime?: Date) {
        const where: any = { deviceId };

        if (startTime || endTime) {
            where.timestamp = {};
            if (startTime) where.timestamp.gte = startTime;
            if (endTime) where.timestamp.lte = endTime;
        }

        return (this.prismaService as any).telemetry.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: points,
        });
    }

    async getLatest(deviceId: string) {
        return (this.prismaService as any).telemetry.findFirst({
            where: { deviceId },
            orderBy: { timestamp: 'desc' },
        });
    }
}
