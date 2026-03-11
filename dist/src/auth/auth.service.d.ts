import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
export declare class AuthService implements OnModuleInit {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    onModuleInit(): Promise<void>;
    register(email: string, pass: string, name?: string): Promise<any>;
    login(email: string, pass: string): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            name: string | null;
            role: string;
        };
    }>;
}
