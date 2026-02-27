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
                const results = await this.redisService.getClient().xreadgroup('GROUP', this.groupName, this.consumerName, 'COUNT', 100, 'BLOCK', 1000, 'STREAMS', this.streamName, '>');
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
        const clean = payload.replace('[', '').replace(']', '');
        const pairs = clean.split(',');
        const dataMap = {};
        pairs.forEach(pair => {
            const [index, value] = pair.split(':').map(s => s.trim());
            if (index && value) {
                dataMap[index] = parseFloat(value);
            }
        });
        return {
            deviceId: 'unknown',
            energy: dataMap['0'] || 0,
            voltage: dataMap['10'] || 0,
            current: dataMap['26'] || 0,
            power: dataMap['51'] || 0,
            frequency: dataMap['44'] || 0,
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
        const interval = this.configService.get('AGGREGATION_WINDOW_MS', 5000);
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
                await this.persistToDb(aggregated);
                await this.redisService.setStatus(deviceId, 'online', 15);
                this.realtimeGateway.sendUpdate(deviceId, aggregated);
            }
            catch (e) {
                this.logger.error(`Failed to flush data for device ${deviceId}: ${e.message}`);
            }
        }
    }
    aggregateRecords(deviceId, records) {
        const count = records.length;
        const sum = records.reduce((acc, r) => ({
            voltage: acc.voltage + (r.voltage || 0),
            current: acc.current + (r.current || 0),
            power: acc.power + (r.power || 0),
            energy: Math.max(acc.energy, r.energy || 0),
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