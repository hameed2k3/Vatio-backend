import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private pool: Pool;

    constructor() {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error('DATABASE_URL is not defined in .env');
        const pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);
        
        super({ adapter } as any);
        this.pool = pool;
    }

    async onModuleInit() {
        await this.$connect();
        this.logger.log('Connected to PostgreSQL Database via Prisma 7 Adapter');
    }

    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool.end();
    }
}
