import { MqttContext } from '@nestjs/microservices';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class IngestionController {
    private readonly redisService;
    private readonly prismaService;
    constructor(redisService: RedisService, prismaService: PrismaService);
    handleTelemetry(data: any, context: MqttContext): Promise<void>;
    getDevices(): Promise<any[]>;
    addDevice(data: any): Promise<any>;
    updateDevice(id: string, data: any): Promise<any>;
    deleteDevice(id: string): Promise<any>;
}
