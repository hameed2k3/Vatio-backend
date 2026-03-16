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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
let TelemetryService = class TelemetryService {
    prismaService;
    redisService;
    constructor(prismaService, redisService) {
        this.prismaService = prismaService;
        this.redisService = redisService;
    }
    async getHistory(deviceId, points, startTime, endTime) {
        const where = { deviceId };
        const takeLimit = points || 20000;
        if (startTime || endTime) {
            where.timestamp = {};
            if (startTime)
                where.timestamp.gte = startTime;
            if (endTime)
                where.timestamp.lte = endTime;
        }
        return this.prismaService.telemetry.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: takeLimit,
        });
    }
    async getAggregatedHistory(deviceId, startTime, endTime) {
        const rangeMs = endTime.getTime() - startTime.getTime();
        const rangeHours = rangeMs / (1000 * 60 * 60);
        let bucket;
        let limit;
        if (rangeHours <= 2) {
            bucket = 'minute';
            limit = 500;
        }
        else if (rangeHours <= 48) {
            bucket = 'hour';
            limit = 200;
        }
        else if (rangeHours <= 24 * 60) {
            bucket = 'day';
            limit = 100;
        }
        else {
            bucket = 'month';
            limit = 50;
        }
        return this.prismaService.$queryRawUnsafe(`SELECT 
                date_trunc('${bucket}', timestamp) as "timestamp",
                AVG(voltage) as "voltage",
                MIN("voltageMin") as "voltageMin",
                MAX("voltageMax") as "voltageMax",
                AVG(current) as "current",
                MIN("currentMin") as "currentMin",
                MAX("currentMax") as "currentMax",
                AVG(power) as "power",
                MIN("powerMin") as "powerMin",
                MAX("powerMax") as "powerMax",
                MAX(energy) as "energy",
                (MAX(energy) - MIN(energy)) as "energyConsumption",
                AVG("voltageUnbalance") as "voltageUnbalance",
                AVG("currentUnbalance") as "currentUnbalance",
                AVG(frequency) as "frequency",
                MAX("importEnergy") as "importEnergy",
                MAX("exportEnergy") as "exportEnergy",
                (MAX("importEnergy") - MIN("importEnergy")) as "consumption",
                (MAX("exportEnergy") - MIN("exportEnergy")) as "solarYield",
                AVG("thdVL1") as "thdVL1",
                AVG("thdVL2") as "thdVL2",
                AVG("thdVL3") as "thdVL3",
                AVG("thdIL1") as "thdIL1",
                AVG("thdIL2") as "thdIL2",
                AVG("thdIL3") as "thdIL3"
            FROM "Telemetry"
            WHERE "deviceId" = $1 
              AND "timestamp" >= $2 
              AND "timestamp" <= $3
            GROUP BY date_trunc('${bucket}', timestamp)
            ORDER BY "timestamp" ASC
            LIMIT ${limit}`, deviceId, startTime, endTime);
    }
    async getLatest(deviceId) {
        return this.prismaService.telemetry.findFirst({
            where: { deviceId },
            orderBy: { timestamp: 'desc' },
        });
    }
    async getLatestFromRedis(deviceId) {
        const data = await this.redisService.getClient().get(`vatio:latest:${deviceId}`);
        return data ? JSON.parse(data) : null;
    }
};
exports.TelemetryService = TelemetryService;
exports.TelemetryService = TelemetryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], TelemetryService);
//# sourceMappingURL=telemetry.service.js.map