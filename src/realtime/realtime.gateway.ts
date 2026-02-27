import { WebSocketGateway, WebSocketServer, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: true,
})
export class RealtimeGateway {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(RealtimeGateway.name);

    @SubscribeMessage('subscribe_device')
    handleSubscribe(client: Socket, deviceId: string) {
        client.join(`device_${deviceId}`);
        this.logger.log(`Client ${client.id} subscribed to device ${deviceId}`);
    }

    @SubscribeMessage('unsubscribe_device')
    handleUnsubscribe(client: Socket, deviceId: string) {
        client.leave(`device_${deviceId}`);
        this.logger.log(`Client ${client.id} unsubscribed from device ${deviceId}`);
    }

    sendUpdate(deviceId: string, data: any) {
        this.server.to(`device_${deviceId}`).emit('telemetry_update', data);
    }
}
