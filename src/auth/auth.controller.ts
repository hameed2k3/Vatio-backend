import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User successfully created' })
    async register(@Body() body: any) {
        return this.authService.register(body.email, body.password, body.name);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login and get JWT token' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    async login(@Body() body: any) {
        return this.authService.login(body.email, body.password);
    }

    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify OTP and get JWT token' })
    @ApiResponse({ status: 200, description: 'OTP verified successfully' })
    async verifyOtp(@Body() body: any) {
        return this.authService.verifyOtp(body.email, body.otp);
    }

    @Post('resend-otp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Resend OTP to email' })
    @ApiResponse({ status: 200, description: 'OTP resent successfully' })
    async resendOtp(@Body() body: any) {
        return this.authService.resendOtp(body.email);
    }
}
