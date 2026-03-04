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

        let records: any[];

        // If a wide range is requested without a specific small point limit, use aggregation
        if (start && end && (!points || parseInt(points) > 1000)) {
            records = await this.telemetryService.getAggregatedHistory(deviceId, start, end);
            console.log(`Aggregated History for ${deviceId}: ${records.length} buckets found`);
        } else {
            records = await this.telemetryService.getHistory(deviceId, limit, start, end);
            console.log(`Raw History for ${deviceId}: ${records.length} records found`);
        }

        if (records.length > 0) console.log(`First record energy: ${records[0].energy}`);

        return records.map(r => ({
            ts: new Date(r.timestamp).getTime(),
            power: r.power,
            voltage: r.voltage,
            phase1Voltage: r.voltage,
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
            deviceId: r.deviceId || deviceId,
        })).reverse();
    }

    @Get(':deviceId/latest')
    async getLatest(@Param('deviceId') deviceId: string) {
        // Try to get from Redis "Hot Cache" first
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

        // Fallback to database
        const latest = await this.telemetryService.getLatest(deviceId);
        if (!latest) return null;

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

    @Get(':deviceId/latest')
    async getLatest(@Param('deviceId') deviceId: string) {
        const records = await this.telemetryService.getHistory(deviceId, 1);
        if (records && records.length > 0) {
            const r = records[0];
            return {
                ts: r.timestamp.getTime(),
                power: r.power,
                voltage: r.voltage,
                current: r.current,
                energy: r.energy,
            };
        }
        return null;
    }
}
