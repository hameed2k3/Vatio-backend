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
                            const dataIndex = fields.indexOf('data');
                            const topicIndex = fields.indexOf('topic');

                            if (dataIndex !== -1 && topicIndex !== -1) {
                                const payload = fields[dataIndex + 1];
                                const topic = fields[topicIndex + 1];
                                const deviceId = topic.split('/').pop();

                                try {
                                    const data = this.parseHardwareString(payload);
                                    if (data) {
                                        data.deviceId = deviceId;
                                        this.bufferData(data);
                                    }
                                } catch (e) {
                                    this.logger.warn(`Failed to parse hardware payload: ${payload}`);
                                }
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

    private parseHardwareString(payload: string): any {
        // Format: [0 : val, 1 : val, ...]
        // Removing brackets
        const clean = payload.replace('[', '').replace(']', '');
        const pairs = clean.split(',');
        const dataMap: any = {};

        pairs.forEach(pair => {
            const [index, value] = pair.split(':').map(s => s.trim());
            if (index && value) {
                dataMap[index] = parseFloat(value);
            }
        });

        // Map indices to object properties based on Vatio_WiFi_4G.ino
        return {
            deviceId: 'unknown', // Will be overridden if we have it in topic
            energy: dataMap['0'] || 0, // Import_kWh
            voltage: dataMap['10'] || 0, // V_L1
            current: dataMap['26'] || 0, // I_L1
            power: dataMap['51'] || 0, // Total_kW
            frequency: dataMap['44'] || 0,
            temp: 0, // Add logic if available
        };
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
                await this.persistToDb(aggregated); // Re-enabled persistence

                // Track online status in Redis with 15s TTL (aggregated every 5s)
                await this.redisService.setStatus(deviceId, 'online', 15);

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
            frequency: acc.frequency + (r.frequency || 0),
        }), { voltage: 0, current: 0, power: 0, energy: 0, temp: 0, frequency: 0 });

        return {
            deviceId,
            timestamp: new Date(),
            voltage: sum.voltage / count,
            current: sum.current / count,
            power: sum.power / count,
            energy: sum.energy,
            temp: sum.temp / count,
            frequency: sum.frequency / count,
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
