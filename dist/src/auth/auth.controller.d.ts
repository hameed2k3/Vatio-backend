export declare class AuthController {
    login(body: any): Promise<{
        user: {
            id: string;
            name: string;
            email: any;
        };
        token: string;
    }>;
    verifyOtp(body: any): Promise<{
        user: {
            id: string;
            name: string;
            email: any;
        };
        token: string;
    }>;
    register(body: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
