import { TelemetryService } from './telemetry.service';
export declare class TelemetryController {
    private readonly telemetryService;
    constructor(telemetryService: TelemetryService);
    getHistory(deviceId: string, points?: string, startTime?: string, endTime?: string): Promise<{
        ts: number;
        power: any;
        voltage: any;
        current: any;
        frequency: any;
        energyKwh: any;
        deviceId: any;
        phase1Voltage: any;
        phase2Voltage: any;
        phase3Voltage: any;
        totalVoltage: any;
        phase1Current: any;
        phase2Current: any;
        phase3Current: any;
        phase1Kw: any;
        phase2Kw: any;
        phase3Kw: any;
        powerFactor: any;
        phase1PF: any;
        phase2PF: any;
        phase3PF: any;
        thd: any;
        thdVL1: any;
        thdVL2: any;
        thdVL3: any;
    }[]>;
    getLatest(deviceId: string): Promise<any>;
}
