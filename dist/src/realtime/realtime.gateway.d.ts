import { Server, Socket } from 'socket.io';
export declare class RealtimeGateway {
    server: Server;
    private readonly logger;
    handleSubscribe(client: Socket, deviceId: string): void;
    handleUnsubscribe(client: Socket, deviceId: string): void;
    sendUpdate(deviceId: string, data: any): void;
}
