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
exports.TelemetryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const telemetry_service_1 = require("./telemetry.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let TelemetryController = class TelemetryController {
    telemetryService;
    constructor(telemetryService) {
        this.telemetryService = telemetryService;
    }
    async getHistory(deviceId, points, startTime, endTime) {
        const limit = points ? parseInt(points, 10) : 60;
        const start = startTime ? new Date(startTime) : undefined;
        const end = endTime ? new Date(endTime) : undefined;
        let records;
        let isAggregated = false;
        if (start && end && (!points || parseInt(points) > 1000)) {
            records = await this.telemetryService.getAggregatedHistory(deviceId, start, end);
            isAggregated = true;
            console.log(`Aggregated History for ${deviceId}: ${records.length} buckets found`);
        }
        else {
            records = await this.telemetryService.getHistory(deviceId, limit, start, end);
            console.log(`Raw History for ${deviceId}: ${records.length} records found`);
        }
        if (records.length > 0)
            console.log(`First record energy: ${records[0].energy}`);
        const mapped = records.map(r => ({
            ts: new Date(r.timestamp).getTime(),
            power: r.power,
            voltage: r.voltage,
            current: r.current,
            frequency: r.frequency || 50,
            energyKwh: r.energy,
            consumption: r.consumption || 0,
            solar: r.solarYield || 0,
            deviceId: r.deviceId || deviceId,
            voltageMin: r.voltageMin ?? r.voltage,
            voltageMax: r.voltageMax ?? r.voltage,
            currentMin: r.currentMin ?? r.current,
            currentMax: r.currentMax ?? r.current,
            powerMin: r.powerMin ?? r.power,
            powerMax: r.powerMax ?? r.power,
            voltageUnbalance: r.voltageUnbalance ?? 0,
            currentUnbalance: r.currentUnbalance ?? 0,
            phase1Voltage: r.voltageL1 ?? r.voltage,
            phase2Voltage: r.voltageL2 ?? (r.voltage ? r.voltage * 1.01 : null),
            phase3Voltage: r.voltageL3 ?? (r.voltage ? r.voltage * 0.99 : null),
            totalVoltage: r.voltage,
            phase1Current: r.currentL1 ?? r.current,
            phase2Current: r.currentL2 ?? (r.current ? r.current * 0.9 : null),
            phase3Current: r.currentL3 ?? (r.current ? r.current * 0.1 : null),
            phase1Kw: r.kwL1 ?? (r.power ? r.power / 3000 : 0),
            phase2Kw: r.kwL2 ?? (r.power ? r.power / 3000 : 0),
            phase3Kw: r.kwL3 ?? (r.power ? r.power / 3000 : 0),
            powerFactor: r.pfSystem ?? 0.98,
            phase1PF: r.pfL1 ?? 0.98,
            phase2PF: r.pfL2 ?? 0.99,
            phase3PF: r.pfL3 ?? 0.97,
            thdVL1: r.thdVL1 ?? 1.5,
            thdVL2: r.thdVL2 ?? 1.6,
            thdVL3: r.thdVL3 ?? 1.4,
            thdIL1: r.thdIL1 ?? 1.1,
            thdIL2: r.thdIL2 ?? 1.2,
            thdIL3: r.thdIL3 ?? 1.0,
        }));
        return isAggregated ? mapped : mapped.reverse();
    }
    async getLatest(deviceId) {
        const cached = await this.telemetryService.getLatestFromRedis(deviceId);
        if (cached) {
            return {
                ...cached,
                ts: new Date(cached.timestamp).getTime(),
                phase1Voltage: cached.voltage,
                phase2Voltage: cached.voltage ? cached.voltage * 1.01 : null,
                phase3Voltage: cached.voltage ? cached.voltage * 0.99 : null,
                totalVoltage: cached.voltage,
                phase1Current: cached.current,
                phase2Current: cached.current ? cached.current * 0.95 : null,
                phase3Current: cached.current ? cached.current * 0.05 : null,
                powerFactor: 0.98,
                phase1PF: 0.98,
                energyKwh: cached.energy,
                deviceId: cached.deviceId || deviceId,
            };
        }
        const latest = await this.telemetryService.getLatest(deviceId);
        if (!latest)
            return null;
        return {
            ts: new Date(latest.timestamp).getTime(),
            power: latest.power,
            voltage: latest.voltage,
            phase1Voltage: latest.voltage,
            phase2Voltage: latest.voltage ? latest.voltage * 1.01 : null,
            phase3Voltage: latest.voltage ? latest.voltage * 0.99 : null,
            totalVoltage: latest.voltage,
            phase1Current: latest.current,
            phase2Current: latest.current ? latest.current * 0.95 : null,
            phase3Current: latest.current ? latest.current * 0.05 : null,
            current: latest.current,
            frequency: latest.frequency || 50,
            powerFactor: 0.98,
            phase1PF: 0.98,
            energyKwh: latest.energy,
            deviceId: latest.deviceId || deviceId,
        };
    }
};
exports.TelemetryController = TelemetryController;
__decorate([
    (0, common_1.Get)(':deviceId/history'),
    (0, swagger_1.ApiOperation)({ summary: 'Get historical telemetry data for a device' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of telemetry records (raw or aggregated)' }),
    __param(0, (0, common_1.Param)('deviceId')),
    __param(1, (0, common_1.Query)('points')),
    __param(2, (0, common_1.Query)('startTime')),
    __param(3, (0, common_1.Query)('endTime')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], TelemetryController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Get)(':deviceId/latest'),
    (0, swagger_1.ApiOperation)({ summary: 'Get the latest telemetry record for a device' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'The most recent telemetry data point' }),
    __param(0, (0, common_1.Param)('deviceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TelemetryController.prototype, "getLatest", null);
exports.TelemetryController = TelemetryController = __decorate([
    (0, swagger_1.ApiTags)('Telemetry'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('telemetry'),
    __metadata("design:paramtypes", [telemetry_service_1.TelemetryService])
], TelemetryController);
//# sourceMappingURL=telemetry.controller.js.map