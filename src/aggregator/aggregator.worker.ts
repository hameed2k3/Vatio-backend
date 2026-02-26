import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class AggregatorWorker implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AggregatorWorker.name);
    private isRunning = true;
    private readonly groupName: string;
    private readonly streamName: string;
    private readonly consumerName = 'consumer-1';
    private aggregationBuffer = new Map<string, any[]>();
    private flushInterval: NodeJS.Timeout;

    constructor(
        private redisService: RedisService,
        private prismaService: PrismaService,
        private configService: ConfigService,
        private readonly realtimeGateway: RealtimeGateway,
    ) {
        this.groupName = this.configService.get<string>('REDIS_GROUP_NAME', 'vatio_aggregator_group');
        this.streamName = this.configService.get<string>('REDIS_STREAM_NAME', 'vatio:telemetry:stream');
    }

    async onModuleInit() {
        await this.setupConsumerGroup();
        this.startConsumerLoop();
        this.startAggregationFlush();
    }

    onModuleDestroy() {
        this.isRunning = false;
        if (this.flushInterval) clearInterval(this.flushInterval);
    }

    private async setupConsumerGroup() {
        try {
            await this.redisService.getClient().xgroup('CREATE', this.streamName, this.groupName, '$', 'MKSTREAM');
        } catch (e) {
            if (!e.message.includes('BUSYGROUP')) {
                this.logger.error(`Error creating consumer group: ${e.message}`);
            }
        }
    }

    private async startConsumerLoop() {
        while (this.isRunning) {
            try {
                const results = await this.redisService.getClient().xreadgroup(
                    'GROUP', this.groupName, this.consumerName,
                    'COUNT', 100,
                    'BLOCK', 1000,
                    'STREAMS', this.streamName, '>',
                ) as any[];

                if (results) {
                    for (const [_, messages] of results) {
                        for (const [id, fields] of messages) {
                            // Extract 'data' field
                            const dataIndex = fields.indexOf('data');
                            if (dataIndex !== -1) {
                                const payload = fields[dataIndex + 1];
                                const data = JSON.parse(payload);
                                this.bufferData(data);
                            }
                            await this.redisService.getClient().xack(this.streamName, this.groupName, id);
                        }
                    }
                }
            } catch (e) {
                this.logger.error(`Error in consumer loop: ${e.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    private bufferData(data: any) {
        const deviceId = data.deviceId;
        if (!deviceId) return;

        if (!this.aggregationBuffer.has(deviceId)) {
            this.aggregationBuffer.set(deviceId, []);
        }
        const buffer = this.aggregationBuffer.get(deviceId)!;
        buffer.push(data);
    }

    private startAggregationFlush() {
        const interval = this.configService.get<number>('AGGREGATION_WINDOW_MS', 5000);
        this.flushInterval = setInterval(() => this.flush(), interval);
    }

    private async flush() {
        if (this.aggregationBuffer.size === 0) return;

        const snapshot = new Map(this.aggregationBuffer);
        this.aggregationBuffer.clear();

        this.logger.log(`Aggregating and flushing ${snapshot.size} devices`);

        for (const [deviceId, records] of snapshot) {
            try {
                const aggregated = this.aggregateRecords(deviceId, records);
                await this.persistToDb(aggregated);
                // Push real-time update throttled by the 5s window
                this.realtimeGateway.sendUpdate(deviceId, aggregated);
            } catch (e) {
                this.logger.error(`Failed to flush data for device ${deviceId}: ${e.message}`);
            }
        }
    }

    private aggregateRecords(deviceId: string, records: any[]) {
        // Simple average aggregation for 5s window
        const count = records.length;
        const sum = records.reduce((acc, r) => ({
            voltage: acc.voltage + (r.voltage || 0),
            current: acc.current + (r.current || 0),
            power: acc.power + (r.power || 0),
            energy: Math.max(acc.energy, r.energy || 0), // Energy usually cumulative
            temp: acc.temp + (r.temp || 0),
        }), { voltage: 0, current: 0, power: 0, energy: 0, temp: 0 });

        return {
            deviceId,
            timestamp: new Date(),
            voltage: sum.voltage / count,
            current: sum.current / count,
            power: sum.power / count,
            energy: sum.energy,
            temp: sum.temp / count,
        };
    }

    private async persistToDb(data: any) {
        // Ensure device exists (practical check)
        await (this.prismaService as any).device.upsert({
            where: { id: data.deviceId },
            update: {},
            create: { id: data.deviceId, name: `Device ${data.deviceId}` },
        });

        await (this.prismaService as any).telemetry.create({
            data: {
                deviceId: data.deviceId,
                timestamp: data.timestamp,
                voltage: data.voltage,
                current: data.current,
                power: data.power,
                energy: data.energy,
                temp: data.temp,
            },
        });
    }
}
