import { Module } from '@nestjs/common';
import { AggregatorWorker } from './aggregator.worker';

@Module({
    providers: [AggregatorWorker],
})
export class AggregatorModule { }
