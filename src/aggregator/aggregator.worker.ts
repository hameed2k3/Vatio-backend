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
        // No setup needed for Lists
    }

    private async startConsumerLoop() {
        while (this.isRunning) {
            if (!this.redisService.getIsConnected()) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                await this.setupConsumerGroup();
                continue;
            }
            try {
                // Use BLPOP for high-efficiency queue consumption (Redis 3.x compatible)
                const result = await this.redisService.getClient().blpop(this.streamName, 1);

                if (result) {
                    const [_, payloadString] = result;
                    const { data: rawData, topic } = JSON.parse(payloadString);
                    let deviceId = topic ? topic.split('/').pop() : 'unknown';

                    // Handle hardware topics
                    if (topic === 'Meter_Reading' || topic === 'test/Meter_Reading') {
                        deviceId = 'NEWDEV_01';
                    }

                    try {
                        const data = this.parseHardwareString(rawData);
                        if (data) {
                            data.deviceId = deviceId;
                            this.bufferData(data);
                        }
                    } catch (e) {
                        this.logger.warn(`Failed to parse hardware payload: ${rawData}`);
                    }
                }
            } catch (e) {
                this.logger.error(`Error in consumer loop: ${e.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    private parseHardwareString(payload: string): any {
        // Format: "[0 : 1514.0759, 1 : 0.00, ...]" or [0 : 1514.0759, ...]
        this.logger.debug(`Raw Hardware Payload: ${payload}`);

        const dataMap: any = {};
        try {
            // Remove surrounding quotes if present, then brackets
            let clean = payload.trim();
            if (clean.startsWith('"') && clean.endsWith('"')) {
                clean = clean.substring(1, clean.length - 1);
            }
            clean = clean.replace(/^\[/, '').replace(/\]$/, '').trim();

            const kvs = clean.split(',').map(kv => kv.trim());

            kvs.forEach(kv => {
                const parts = kv.split(':').map(p => p.trim());
                if (parts.length === 2) {
                    const [key, val] = parts;
                    dataMap[key] = parseFloat(val);
                }
            });
        } catch (err) {
            this.logger.error(`Error splitting payload: ${err.message}`);
        }

        const energy = dataMap['0'];
        this.logger.debug(`Energy at index 0: ${energy}`);

        // Map ALL indices to object properties based on Vatio_WiFi_4G.ino
        return {
            deviceId: 'unknown',
            // Energy
            importEnergy: isNaN(energy) ? 0 : energy,
            exportEnergy: dataMap['1'] || 0,
            netEnergy: dataMap['2'] || 0,
            energy: isNaN(energy) ? 0 : energy, // Backward compat
            // Per-phase Voltages
            voltageL1: dataMap['10'] || 0,
            voltageL2: dataMap['12'] || 0,
            voltageL3: dataMap['14'] || 0,
            voltageAvg: dataMap['16'] || 0,
            // Aggregate voltage (backward compat)
            voltage: dataMap['16'] || dataMap['10'] || 0,
            // Per-phase Currents
            currentL1: dataMap['26'] || 0,
            currentL2: dataMap['28'] || 0,
            currentL3: dataMap['30'] || 0,
            currentAvg: dataMap['32'] || 0,
            current: dataMap['32'] || dataMap['26'] || 0,
            // Per-phase Power Factor
            pfL1: dataMap['39'] || 0,
            pfL2: dataMap['40'] || 0,
            pfL3: dataMap['41'] || 0,
            pfSystem: dataMap['42'] || 0,
            pfAvg: dataMap['43'] || 0,
            // Frequency
            frequency: dataMap['44'] || 0,
            // Per-phase kW
            kwL1: dataMap['45'] || 0,
            kwL2: dataMap['47'] || 0,
            kwL3: dataMap['49'] || 0,
            // Total Power
            power: dataMap['51'] || 0,
            kva: dataMap['53'] || 0,
            kvar: dataMap['55'] || 0,
            // THD
            thdVL1: dataMap['69'] || 0,
            thdVL2: dataMap['70'] || 0,
            thdVL3: dataMap['71'] || 0,
            thdIL1: dataMap['72'] || 0,
            thdIL2: dataMap['73'] || 0,
            thdIL3: dataMap['74'] || 0,
            temp: 0,
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
        const interval = this.configService.get<number>('AGGREGATION_WINDOW_MS', 1000);
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
                this.logger.log(`Device ${deviceId} Aggregated: ${JSON.stringify(aggregated)}`);
                await this.persistToDb(aggregated); // Re-enabled persistence

                // Track online status in Redis with 15s TTL (aggregated every 5s)
                await this.redisService.setStatus(deviceId, 'online', 15);

                // Cache the absolute latest record for instant refresh/load (60s TTL)
                await this.redisService.getClient().set(
                    `vatio:latest:${deviceId}`,
                    JSON.stringify(aggregated),
                    'EX', 60
                );

                // Push real-time update throttled by the 5s window
                this.realtimeGateway.sendUpdate(deviceId, aggregated);
            } catch (e) {
                this.logger.error(`Failed to flush data for device ${deviceId}: ${e.message}`);
            }
        }
    }

    private aggregateRecords(deviceId: string, records: any[]) {
        const count = records.length;
        const avg = (field: string) => records.reduce((s, r) => s + (r[field] || 0), 0) / count;
        const max = (field: string) => records.reduce((m, r) => Math.max(m, r[field] || 0), -Infinity);
        const min = (field: string) => records.reduce((m, r) => Math.min(m, r[field] || 0), Infinity);

        const vAvg = avg('voltage');
        const iAvg = avg('current');
        const pAvg = avg('power');

        // Unbalance Calculation (Max deviation from average / average * 100)
        const calcUnbalance = (phases: number[], average: number) => {
            if (average === 0) return 0;
            const maxDev = Math.max(...phases.map(p => Math.abs(p - average)));
            return (maxDev / average) * 100;
        };

        const vL1 = avg('voltageL1');
        const vL2 = avg('voltageL2');
        const vL3 = avg('voltageL3');
        const cL1 = avg('currentL1');
        const cL2 = avg('currentL2');
        const cL3 = avg('currentL3');

        return {
            deviceId,
            timestamp: new Date(),
            // Statistics
            voltage: vAvg,
            voltageMin: min('voltage'),
            voltageMax: max('voltage'),
            current: iAvg,
            currentMin: min('current'),
            currentMax: max('current'),
            power: pAvg,
            powerMin: min('power'),
            powerMax: max('power'),

            energy: max('energy'),
            netEnergy: avg('netEnergy'),
            importEnergy: max('importEnergy'),
            exportEnergy: max('exportEnergy'),

            temp: avg('temp'),
            frequency: avg('frequency'),

            // Unbalance
            voltageUnbalance: calcUnbalance([vL1, vL2, vL3], vAvg),
            currentUnbalance: calcUnbalance([cL1, cL2, cL3], iAvg),

            // Per-phase voltages
            voltageL1: vL1,
            voltageL2: vL2,
            voltageL3: vL3,
            voltageAvg: avg('voltageAvg'),
            // Per-phase currents
            currentL1: cL1,
            currentL2: cL2,
            currentL3: cL3,
            currentAvg: avg('currentAvg'),
            // Per-phase PF
            pfL1: avg('pfL1'),
            pfL2: avg('pfL2'),
            pfL3: avg('pfL3'),
            pfSystem: avg('pfSystem'),
            pfAvg: avg('pfAvg'),
            // Per-phase kW
            kwL1: avg('kwL1'),
            kwL2: avg('kwL2'),
            kwL3: avg('kwL3'),
            // Apparent/Reactive
            kva: avg('kva'),
            kvar: avg('kvar'),
            // THD
            thdVL1: avg('thdVL1'),
            thdVL2: avg('thdVL2'),
            thdVL3: avg('thdVL3'),
            thdIL1: avg('thdIL1'),
            thdIL2: avg('thdIL2'),
            thdIL3: avg('thdIL3'),
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
                frequency: data.frequency,
                // Per-phase
                voltageL1: data.voltageL1,
                voltageL2: data.voltageL2,
                voltageL3: data.voltageL3,
                currentL1: data.currentL1,
                currentL2: data.currentL2,
                currentL3: data.currentL3,
                pfL1: data.pfL1,
                pfL2: data.pfL2,
                pfL3: data.pfL3,
                pfSystem: data.pfSystem,
                kwL1: data.kwL1,
                kwL2: data.kwL2,
                kwL3: data.kwL3,
                kva: data.kva,
                kvar: data.kvar,
                thdVL1: data.thdVL1,
                thdVL2: data.thdVL2,
                thdVL3: data.thdVL3,
                thdIL1: data.thdIL1,
                thdIL2: data.thdIL2,
                thdIL3: data.thdIL3,
                // Statistics
                voltageMin: data.voltageMin,
                voltageMax: data.voltageMax,
                currentMin: data.currentMin,
                currentMax: data.currentMax,
                powerMin: data.powerMin,
                powerMax: data.powerMax,
                voltageUnbalance: data.voltageUnbalance,
                currentUnbalance: data.currentUnbalance,
                netEnergy: data.netEnergy,
                importEnergy: data.importEnergy,
                exportEnergy: data.exportEnergy,
                temp: data.temp,
            },
        });
    }
}
