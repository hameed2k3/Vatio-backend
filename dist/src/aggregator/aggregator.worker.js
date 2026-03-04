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
    consumerName = `consumer-${Math.random().toString(36).slice(2, 6)}`;
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
        try {
            await this.redisService.getClient().xgroup('CREATE', this.streamName, this.groupName, '$', 'MKSTREAM');
        }
        catch (e) {
            if (!e.message.includes('BUSYGROUP')) {
                this.logger.error(`Error creating consumer group: ${e.message}`);
            }
        }
    }
    async startConsumerLoop() {
        while (this.isRunning) {
            try {
                const results = await this.redisService.getClient().xreadgroup('GROUP', this.groupName, this.consumerName, 'COUNT', 50, 'BLOCK', 1000, 'STREAMS', this.streamName, '>');
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
                                }
                                catch (e) {
                                    this.logger.warn(`Failed to parse hardware payload: ${payload}`);
                                }
                            }
                            await this.redisService.getClient().xack(this.streamName, this.groupName, id);
                        }
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
                    dataMap[parts[0]] = parseFloat(parts[1]);
                }
            });
        }
        catch (err) {
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
    bufferData(data) {
        if (!data.deviceId)
            return;
        if (!this.aggregationBuffer.has(data.deviceId)) {
            this.aggregationBuffer.set(data.deviceId, []);
        }
        this.aggregationBuffer.get(data.deviceId).push(data);
    }
    startAggregationFlush() {
        const interval = this.configService.get('AGGREGATION_WINDOW_MS', 5000);
        this.flushInterval = setInterval(() => this.flush(), interval);
    }
    async flush() {
        if (this.aggregationBuffer.size === 0)
            return;
        const snapshot = new Map(this.aggregationBuffer);
        this.aggregationBuffer.clear();
        for (const [deviceId, records] of snapshot) {
            try {
                const aggregated = this.aggregateRecords(deviceId, records);
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
        const max = (field) => records.reduce((m, r) => Math.max(m, r[field] || 0), 0);
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