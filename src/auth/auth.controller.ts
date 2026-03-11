import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

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
}
