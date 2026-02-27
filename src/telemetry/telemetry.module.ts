import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [TelemetryController],
    providers: [TelemetryService],
    exports: [TelemetryService],
})
export class TelemetryModule { }
