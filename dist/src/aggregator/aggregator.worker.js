"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AggregatorWorker_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AggregatorWorker = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../redis/redis.service");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@nestjs/config");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
let AggregatorWorker = AggregatorWorker_1 = class AggregatorWorker {
    redisService;
    prismaService;
    configService;
    realtimeGateway;
    logger = new common_1.Logger(AggregatorWorker_1.name);
    isRunning = true;
    groupName;
    streamName;
    consumerName = 'consumer-1';
    aggregationBuffer = new Map();
    flushInterval;
    constructor(redisService, prismaService, configService, realtimeGateway) {
        this.redisService = redisService;
        this.prismaService = prismaService;
        this.configService = configService;
        this.realtimeGateway = realtimeGateway;
        this.groupName = this.configService.get('REDIS_GROUP_NAME', 'vatio_aggregator_group');
        this.streamName = this.configService.get('REDIS_STREAM_NAME', 'vatio:telemetry:stream');
    }
    async onModuleInit() {
        await this.setupConsumerGroup();
        this.startConsumerLoop();
        this.startAggregationFlush();
    }
    onModuleDestroy() {
        this.isRunning = false;
        if (this.flushInterval)
            clearInterval(this.flushInterval);
    }
    async setupConsumerGroup() {
    }
    async startConsumerLoop() {
        while (this.isRunning) {
            if (!this.redisService.getIsConnected()) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                await this.setupConsumerGroup();
                continue;
            }
            try {
                const result = await this.redisService.getClient().blpop(this.streamName, 1);
                if (result) {
                    const [_, payloadString] = result;
                    const { data: rawData, topic } = JSON.parse(payloadString);
                    let deviceId = topic ? topic.split('/').pop() : 'unknown';
                    if (topic === 'Meter_Reading' || topic === 'test/Meter_Reading') {
                        deviceId = 'NEWDEV_01';
                    }
                    try {
                        const data = this.parseHardwareString(rawData);
                        if (data) {
                            data.deviceId = deviceId;
                            this.bufferData(data);
                        }
                    }
                    catch (e) {
                        this.logger.warn(`Failed to parse hardware payload: ${rawData}`);
                    }
                }
            }
            catch (e) {
                this.logger.error(`Error in consumer loop: ${e.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    parseHardwareString(payload) {
        this.logger.debug(`Raw Hardware Payload: ${payload}`);
        const dataMap = {};
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
                    const [key, val] = parts;
                    dataMap[key] = parseFloat(val);
                }
            });
        }
        catch (err) {
            this.logger.error(`Error splitting payload: ${err.message}`);
        }
        const energy = dataMap['0'];
        this.logger.debug(`Energy at index 0: ${energy}`);
        return {
            deviceId: 'unknown',
            importEnergy: isNaN(energy) ? 0 : energy,
            exportEnergy: dataMap['1'] || 0,
            netEnergy: dataMap['2'] || 0,
            energy: isNaN(energy) ? 0 : energy,
            voltageL1: dataMap['10'] || 0,
            voltageL2: dataMap['12'] || 0,
            voltageL3: dataMap['14'] || 0,
            voltageAvg: dataMap['16'] || 0,
            voltage: dataMap['16'] || dataMap['10'] || 0,
            currentL1: dataMap['26'] || 0,
            currentL2: dataMap['28'] || 0,
            currentL3: dataMap['30'] || 0,
            currentAvg: dataMap['32'] || 0,
            current: dataMap['32'] || dataMap['26'] || 0,
            pfL1: dataMap['39'] || 0,
            pfL2: dataMap['40'] || 0,
            pfL3: dataMap['41'] || 0,
            pfSystem: dataMap['42'] || 0,
            pfAvg: dataMap['43'] || 0,
            frequency: dataMap['44'] || 0,
            kwL1: dataMap['45'] || 0,
            kwL2: dataMap['47'] || 0,
            kwL3: dataMap['49'] || 0,
            power: dataMap['51'] || 0,
            kva: dataMap['53'] || 0,
            kvar: dataMap['55'] || 0,
            thdVL1: dataMap['69'] || 0,
            thdVL2: dataMap['70'] || 0,
            thdVL3: dataMap['71'] || 0,
            thdIL1: dataMap['72'] || 0,
            thdIL2: dataMap['73'] || 0,
            thdIL3: dataMap['74'] || 0,
            temp: 0,
        };
    }
    bufferData(data) {
        const deviceId = data.deviceId;
        if (!deviceId)
            return;
        if (!this.aggregationBuffer.has(deviceId)) {
            this.aggregationBuffer.set(deviceId, []);
        }
        const buffer = this.aggregationBuffer.get(deviceId);
        buffer.push(data);
    }
    startAggregationFlush() {
        const interval = this.configService.get('AGGREGATION_WINDOW_MS', 1000);
        this.flushInterval = setInterval(() => this.flush(), interval);
    }
    async flush() {
        if (this.aggregationBuffer.size === 0)
            return;
        const snapshot = new Map(this.aggregationBuffer);
        this.aggregationBuffer.clear();
        this.logger.log(`Aggregating and flushing ${snapshot.size} devices`);
        for (const [deviceId, records] of snapshot) {
            try {
                const aggregated = this.aggregateRecords(deviceId, records);
                this.logger.log(`Device ${deviceId} Aggregated: ${JSON.stringify(aggregated)}`);
                await this.persistToDb(aggregated);
                await this.redisService.setStatus(deviceId, 'online', 15);
                await this.redisService.getClient().set(`vatio:latest:${deviceId}`, JSON.stringify(aggregated), 'EX', 60);
                this.realtimeGateway.sendUpdate(deviceId, aggregated);
            }
            catch (e) {
                this.logger.error(`Failed to flush data for device ${deviceId}: ${e.message}`);
            }
        }
    }
    aggregateRecords(deviceId, records) {
        const count = records.length;
        const avg = (field) => records.reduce((s, r) => s + (r[field] || 0), 0) / count;
        const max = (field) => records.reduce((m, r) => Math.max(m, r[field] || 0), -Infinity);
        const min = (field) => records.reduce((m, r) => Math.min(m, r[field] || 0), Infinity);
        const vAvg = avg('voltage');
        const iAvg = avg('current');
        const pAvg = avg('power');
        const calcUnbalance = (phases, average) => {
            if (average === 0)
                return 0;
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
            voltageUnbalance: calcUnbalance([vL1, vL2, vL3], vAvg),
            currentUnbalance: calcUnbalance([cL1, cL2, cL3], iAvg),
            voltageL1: vL1,
            voltageL2: vL2,
            voltageL3: vL3,
            voltageAvg: avg('voltageAvg'),
            currentL1: cL1,
            currentL2: cL2,
            currentL3: cL3,
            currentAvg: avg('currentAvg'),
            pfL1: avg('pfL1'),
            pfL2: avg('pfL2'),
            pfL3: avg('pfL3'),
            pfSystem: avg('pfSystem'),
            pfAvg: avg('pfAvg'),
            kwL1: avg('kwL1'),
            kwL2: avg('kwL2'),
            kwL3: avg('kwL3'),
            kva: avg('kva'),
            kvar: avg('kvar'),
            thdVL1: avg('thdVL1'),
            thdVL2: avg('thdVL2'),
            thdVL3: avg('thdVL3'),
            thdIL1: avg('thdIL1'),
            thdIL2: avg('thdIL2'),
            thdIL3: avg('thdIL3'),
        };
    }
    async persistToDb(data) {
        await this.prismaService.device.upsert({
            where: { id: data.deviceId },
            update: {},
            create: { id: data.deviceId, name: `Device ${data.deviceId}` },
        });
        await this.prismaService.telemetry.create({
            data: {
                deviceId: data.deviceId,
                timestamp: data.timestamp,
                voltage: data.voltage,
                current: data.current,
                power: data.power,
                energy: data.energy,
                frequency: data.frequency,
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
                voltageMin: data.voltageMin,
                voltageMax: data.voltageMax,
                currentMin: data.currentMin,
                currentMax: data.currentMax,
                powerMin: data.powerMin,
                powerMax: data.powerMax,
                voltageUnbalance: data.voltageUnbalance,
                currentUnbalance: data.currentUnbalance,
                netEnergy: data.netEnergy,
                temp: data.temp,
            },
        });
    }
};
exports.AggregatorWorker = AggregatorWorker;
exports.AggregatorWorker = AggregatorWorker = AggregatorWorker_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        prisma_service_1.PrismaService,
        config_1.ConfigService,
        realtime_gateway_1.RealtimeGateway])
], AggregatorWorker);
//# sourceMappingURL=aggregator.worker.js.map