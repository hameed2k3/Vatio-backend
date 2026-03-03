import { Controller, Get, Post, Put, Delete, Param } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, MqttContext } from '@nestjs/microservices';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('ingestion')
export class IngestionController {
    constructor(
        private readonly redisService: RedisService,
        private readonly prismaService: PrismaService,
    ) { }

    @MessagePattern('Meter_Reading')
    async handleWifiTelemetry(@Payload() data: any, @Ctx() context: MqttContext) {
        await this.redisService.addToStream(data, context.getTopic());
    }

    @MessagePattern('test/Meter_Reading')
    async handle4GTelemetry(@Payload() data: any, @Ctx() context: MqttContext) {
        await this.redisService.addToStream(data, context.getTopic());
    }

    @MessagePattern('vatio/telemetry/#')
    async handleTelemetry(@Payload() data: any, @Ctx() context: MqttContext) {
        // Pipe directly to Redis Stream for sub-millisecond ingestion
        const topic = context.getTopic();
        await this.redisService.addToStream(data, topic);
    }

    @Get('devices')
    async getDevices() {
        const devices = await (this.prismaService as any).device.findMany({
            orderBy: { createdAt: 'desc' }
        });

        // Enrich with live status from Redis
        return Promise.all(devices.map(async (d: any) => ({
            ...d,
            status: await this.redisService.getStatus(d.id)
        })));
    }

    @Post('devices')
    async addDevice(@Payload() data: any) {
        return (this.prismaService as any).device.create({
            data: {
                id: data.id || `dev_${Math.floor(Math.random() * 10000)}`,
                name: data.name,
                type: data.type,
                location: data.location,
            }
        });
    }

    @Put('devices/:id')
    async updateDevice(@Param('id') id: string, @Payload() data: any) {
        return (this.prismaService as any).device.update({
            where: { id },
            data: {
                name: data.name,
                type: data.type,
                location: data.location,
            }
        });
    }

    @Delete('devices/:id')
    async deleteDevice(@Param('id') id: string) {
        return (this.prismaService as any).device.delete({
            where: { id }
        });
    }
}
