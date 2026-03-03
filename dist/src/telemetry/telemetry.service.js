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
        return this.prismaService.$queryRaw `
            SELECT 
                date_trunc('minute', timestamp) as "timestamp",
                AVG(voltage) as "voltage",
                AVG(current) as "current",
                AVG(power) as "power",
                MAX(energy) as "energy",
                AVG(frequency) as "frequency"
            FROM "Telemetry"
            WHERE "deviceId" = ${deviceId} 
              AND "timestamp" >= ${startTime} 
              AND "timestamp" <= ${endTime}
            GROUP BY "timestamp"
            ORDER BY "timestamp" DESC
            LIMIT 5000
        `;
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