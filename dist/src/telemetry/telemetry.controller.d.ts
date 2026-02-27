import { TelemetryService } from './telemetry.service';
export declare class TelemetryController {
    private readonly telemetryService;
    constructor(telemetryService: TelemetryService);
    getHistory(deviceId: string, points?: string, startTime?: string, endTime?: string): Promise<any>;
}
