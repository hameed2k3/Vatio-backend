import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';

@Controller('auth')
export class AuthController {
    @Post('login')
    async login(@Body() body: any) {
        const { email, password } = body;
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@vatio.io';
        const adminPass = process.env.ADMIN_PASSWORD || 'password';

        if (email === adminEmail && password === adminPass) {
            return {
                user: { id: 'U001', name: 'Admin', email },
                token: 'real-backend-jwt-token'
            };
        }
        throw new UnauthorizedException('Invalid credentials');
    }

    @Post('verify-otp')
    async verifyOtp(@Body() body: any) {
        return {
            user: { id: 'U001', name: 'Admin', email: body.email },
            token: 'real-backend-jwt-token'
        };
    }

    @Post('register')
    async register(@Body() body: any) {
        return { success: true, message: 'OTP sent' };
    }
}
