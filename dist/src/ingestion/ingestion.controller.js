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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const redis_service_1 = require("../redis/redis.service");
const prisma_service_1 = require("../prisma/prisma.service");
let IngestionController = class IngestionController {
    redisService;
    prismaService;
    constructor(redisService, prismaService) {
        this.redisService = redisService;
        this.prismaService = prismaService;
    }
    async handleWifiTelemetry(data, context) {
        await this.redisService.pushToQueue(data, context.getTopic());
    }
    async handle4GTelemetry(data, context) {
        await this.redisService.pushToQueue(data, context.getTopic());
    }
    async handleTelemetry(data, context) {
        const topic = context.getTopic();
        await this.redisService.pushToQueue(data, topic);
    }
    async getDevices() {
        const devices = await this.prismaService.device.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return Promise.all(devices.map(async (d) => ({
            ...d,
            status: await this.redisService.getStatus(d.id)
        })));
    }
    async addDevice(data) {
        return this.prismaService.device.create({
            data: {
                id: data.id || `dev_${Math.floor(Math.random() * 10000)}`,
                name: data.name,
                type: data.type,
                location: data.location,
            }
        });
    }
    async updateDevice(id, data) {
        return this.prismaService.device.update({
            where: { id },
            data: {
                name: data.name,
                type: data.type,
                location: data.location,
            }
        });
    }
    async deleteDevice(id) {
        return this.prismaService.device.delete({
            where: { id }
        });
    }
};
exports.IngestionController = IngestionController;
__decorate([
    (0, microservices_1.MessagePattern)('Meter_Reading'),
    __param(0, (0, microservices_1.Payload)()),
    __param(1, (0, microservices_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, microservices_1.MqttContext]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "handleWifiTelemetry", null);
__decorate([
    (0, microservices_1.MessagePattern)('test/Meter_Reading'),
    __param(0, (0, microservices_1.Payload)()),
    __param(1, (0, microservices_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, microservices_1.MqttContext]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "handle4GTelemetry", null);
__decorate([
    (0, microservices_1.MessagePattern)('vatio/telemetry/#'),
    __param(0, (0, microservices_1.Payload)()),
    __param(1, (0, microservices_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, microservices_1.MqttContext]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "handleTelemetry", null);
__decorate([
    (0, common_1.Get)('devices'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "getDevices", null);
__decorate([
    (0, common_1.Post)('devices'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "addDevice", null);
__decorate([
    (0, common_1.Put)('devices/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "updateDevice", null);
__decorate([
    (0, common_1.Delete)('devices/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "deleteDevice", null);
exports.IngestionController = IngestionController = __decorate([
    (0, common_1.Controller)('ingestion'),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        prisma_service_1.PrismaService])
], IngestionController);
//# sourceMappingURL=ingestion.controller.js.map