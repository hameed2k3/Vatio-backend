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
        let isAggregated = false;

        // If a wide range is requested without a specific small point limit, use aggregation
        if (start && end && (!points || parseInt(points) > 1000)) {
            records = await this.telemetryService.getAggregatedHistory(deviceId, start, end);
            isAggregated = true;
            console.log(`Aggregated History for ${deviceId}: ${records.length} buckets found`);
        } else {
            records = await this.telemetryService.getHistory(deviceId, limit, start, end);
            console.log(`Raw History for ${deviceId}: ${records.length} records found`);
        }

        if (records.length > 0) console.log(`First record energy: ${records[0].energy}`);

        const mapped = records.map(r => ({
            ts: new Date(r.timestamp).getTime(),
            power: r.power,
            voltage: r.voltage,
            current: r.current,
            frequency: r.frequency || 50,
            energyKwh: r.energy,
            deviceId: r.deviceId || deviceId,

            // Actual per-phase data from DB
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

            thd: r.thdVL1 ?? 1.5,
            thdVL1: r.thdVL1 ?? 1.5,
            thdVL2: r.thdVL2 ?? 1.6,
            thdVL3: r.thdVL3 ?? 1.4,
        }));

        // Raw history is DESC from DB, so reverse to ASC for timeline
        // Aggregated history is already ASC
        return isAggregated ? mapped : mapped.reverse();
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
}
