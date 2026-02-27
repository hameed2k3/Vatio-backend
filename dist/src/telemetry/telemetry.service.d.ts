import { PrismaService } from '../prisma/prisma.service';
export declare class TelemetryService {
    private readonly prismaService;
    constructor(prismaService: PrismaService);
    getHistory(deviceId: string, points?: number, startTime?: Date, endTime?: Date): Promise<any>;
    getLatest(deviceId: string): Promise<any>;
}
