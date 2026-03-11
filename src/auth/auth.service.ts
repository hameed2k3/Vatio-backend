import { Injectable, UnauthorizedException, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService implements OnModuleInit {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService
    ) {}

    async onModuleInit() {
        const adminEmail = 'admin@vatio.io';
        const existing = await this.prisma.user.findUnique({ where: { email: adminEmail } });
        if (!existing) {
            const hashedPassword = await bcrypt.hash('password', 10);
            await this.prisma.user.create({
                data: {
                    email: adminEmail,
                    password: hashedPassword,
                    name: 'System Admin',
                    role: 'admin'
                }
            });
            console.log('✅ Default admin user created: admin@vatio.io');
        }
    }

    async register(email: string, pass: string, name?: string) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) throw new ConflictException('Email already registered');

        const hashedPassword = await bcrypt.hash(pass, 10);
        return await (this.prisma as any).user.create({
            data: {
                email,
                name,
                password: hashedPassword
            }
        });
    }

    async login(email: string, pass: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const isMatch = await bcrypt.compare(pass, user.password);
        if (!isMatch) throw new UnauthorizedException('Invalid credentials');

        const payload = { sub: user.id, email: user.email, role: user.role };
        return {
            access_token: await this.jwtService.signAsync(payload),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        };
    }
}
