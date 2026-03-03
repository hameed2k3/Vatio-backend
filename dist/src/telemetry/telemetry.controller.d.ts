import { TelemetryService } from './telemetry.service';
export declare class TelemetryController {
    private readonly telemetryService;
    constructor(telemetryService: TelemetryService);
    getHistory(deviceId: string, points?: string, startTime?: string, endTime?: string): Promise<{
        ts: number;
        power: any;
        voltage: any;
        phase1Voltage: any;
        phase2Voltage: number | null;
        phase3Voltage: number | null;
        totalVoltage: any;
        phase1Current: any;
        phase2Current: number | null;
        phase3Current: number | null;
        current: any;
        frequency: any;
        powerFactor: number;
        phase1PF: number;
        phase2PF: number;
        phase3PF: number;
        thd: number;
        energyKwh: any;
        deviceId: any;
    }[]>;
    getLatest(deviceId: string): Promise<any>;
}
