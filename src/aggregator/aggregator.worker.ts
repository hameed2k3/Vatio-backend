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
    private readonly consumerName = `consumer-${Math.random().toString(36).slice(2, 6)}`;
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
                    'COUNT', 50,
                    'BLOCK', 1000,
                    'STREAMS', this.streamName, '>',
                ) as any[];

                if (results) {
                    for (const [_, messages] of results) {
                        for (const [id, fields] of messages) {
                            const dataIdx = fields.indexOf('data');
                            const topicIdx = fields.indexOf('topic');

                            if (dataIdx !== -1) {
                                const payload = fields[dataIdx + 1];
                                const topic = topicIdx !== -1 ? fields[topicIdx + 1] : '';

                                try {
                                    const data = this.parseHardwareString(payload);
                                    if (data) {
                                        let deviceId = topic.split('/').pop();
                                        if (topic === 'Meter_Reading' || topic === 'test/Meter_Reading' || !deviceId) {
                                            deviceId = 'NEWDEV_01';
                                        }
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
        const dataMap: any = {};
        try {
            let clean = payload.trim();
            if (clean.startsWith('"') && clean.endsWith('"')) {
                clean = clean.substring(1, clean.length - 1);
            }
            clean = clean.replace(/^\[/, '').replace(/\]$/, '').trim();

            const kvs = clean.split(',').map(kv => kv.trim());
            kvs.forEach(kv => {
                const parts = kv.split(':').map(p => p.trim());
                if (parts.length === 2) {
                    dataMap[parts[0]] = parseFloat(parts[1]);
                }
            });
        } catch (err) {
            this.logger.error(`Error splitting payload: ${err.message}`);
            return null;
        }

        const energy = dataMap['0'];
        return {
            deviceId: 'unknown',
            energy: isNaN(energy) ? 0 : energy,
            voltage: dataMap['16'] || dataMap['10'] || 0,
            current: dataMap['32'] || dataMap['26'] || 0,
            power: dataMap['51'] || 0,
            frequency: dataMap['44'] || 0,
            temp: 0,
        };
    }

    private bufferData(data: any) {
        if (!data.deviceId) return;
        if (!this.aggregationBuffer.has(data.deviceId)) {
            this.aggregationBuffer.set(data.deviceId, []);
        }
        this.aggregationBuffer.get(data.deviceId)!.push(data);
    }

    private startAggregationFlush() {
        const interval = this.configService.get<number>('AGGREGATION_WINDOW_MS', 5000);
        this.flushInterval = setInterval(() => this.flush(), interval);
    }

    private async flush() {
        if (this.aggregationBuffer.size === 0) return;

        const snapshot = new Map(this.aggregationBuffer);
        this.aggregationBuffer.clear();

        for (const [deviceId, records] of snapshot) {
            try {
                const aggregated = this.aggregateRecords(deviceId, records);
                await this.persistToDb(aggregated);
                await this.redisService.setStatus(deviceId, 'online', 15);
                await this.redisService.getClient().set(
                    `vatio:latest:${deviceId}`,
                    JSON.stringify(aggregated),
                    'EX', 60
                );
                this.realtimeGateway.sendUpdate(deviceId, aggregated);
            } catch (e) {
                this.logger.error(`Failed to flush data for device ${deviceId}: ${e.message}`);
            }
        }
    }

    private aggregateRecords(deviceId: string, records: any[]) {
        const count = records.length;
        const avg = (field: string) => records.reduce((s, r) => s + (r[field] || 0), 0) / count;
        const max = (field: string) => records.reduce((m, r) => Math.max(m, r[field] || 0), 0);

        return {
            deviceId,
            timestamp: new Date(),
            voltage: avg('voltage'),
            current: avg('current'),
            power: avg('power'),
            energy: max('energy'),
            temp: avg('temp'),
            frequency: avg('frequency'),
        };
    }

    private async persistToDb(data: any) {
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
