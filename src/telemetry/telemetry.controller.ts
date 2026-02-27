import { Controller, Get, Param, Query } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Controller('telemetry')
export class TelemetryController {
    constructor(private readonly telemetryService: TelemetryService) { }

    @Get(':deviceId/history')
    async getHistory(
        @Param('deviceId') deviceId: string,
        @Query('points') points?: string,
        @Query('startTime') startTime?: string,
        @Query('endTime') endTime?: string,
    ) {
        const limit = points ? parseInt(points, 10) : 60;
        const start = startTime ? new Date(startTime) : undefined;
        const end = endTime ? new Date(endTime) : undefined;

        const records = await this.telemetryService.getHistory(deviceId, limit, start, end);

        // Map to frontend expected format if needed, or return raw
        return records.map(r => ({
            ts: r.timestamp.getTime(),
            power: r.power,
            voltage: r.voltage,
            phase1Voltage: r.voltage, // Simulation simplification
            phase2Voltage: r.voltage ? r.voltage * 1.01 : null,
            phase3Voltage: r.voltage ? r.voltage * 0.99 : null,
            totalVoltage: r.voltage,
            phase1Current: r.current,
            phase2Current: r.current ? r.current * 0.9 : null,
            phase3Current: r.current ? r.current * 0.1 : null,
            current: r.current,
            frequency: r.frequency || 50,
            powerFactor: 0.98,
            phase1PF: 0.98,
            phase2PF: 0.99,
            phase3PF: 0.97,
            thd: 1.5,
            energyKwh: r.energy,
            deviceId: r.deviceId,
        })).reverse(); // Return in chronological order for charts
    }
}
