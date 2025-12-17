import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  TUNNEL_EVENTS,
  IncomingRequest,
  OutgoingResponse,
  RequestLog,
} from '@tunnel-hub/shared';
import { Subject, firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

export interface TunnelInfo {
  socketId: string;
  password?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  maxHttpBufferSize: 50 * 1024 * 1024,
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private responseSubjects = new Map<string, Subject<OutgoingResponse>>();

  private tunnelConnections = new Map<string, TunnelInfo>();

  async handleConnection(client: Socket) {
    const tunnelId = client.handshake.query.tunnelId as string;
    const password = client.handshake.auth.password as string;

    if (tunnelId) {
      if (this.tunnelConnections.has(tunnelId)) {
        console.log(
          `⚠️ Tunnel ID conflict: ${tunnelId}. Disconnecting new client.`,
        );
        client.disconnect();
        return;
      }

      await client.join(tunnelId);

      this.tunnelConnections.set(tunnelId, { socketId: client.id, password });

      console.log(
        `✅ Client Connected: ${client.id} (Tunnel ID: ${tunnelId}, Password: ${
          password ? 'Yes' : 'No'
        })`,
      );
    } else {
      console.log(`⚠️ Client Connected without Tunnel ID: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client Disconnected: ${client.id}`);
    for (const [tid, info] of this.tunnelConnections.entries()) {
      if (info.socketId === client.id) {
        this.tunnelConnections.delete(tid);
        console.log(`🗑 Released Tunnel ID: ${tid}`);
        break;
      }
    }
  }

  getTunnelInfo(tunnelId: string): TunnelInfo | undefined {
    return this.tunnelConnections.get(tunnelId);
  }

  @SubscribeMessage(TUNNEL_EVENTS.RESPONSE_OUTGOING)
  handleResponse(@MessageBody() response: OutgoingResponse): void {
    console.log(
      `📩 [Server] Received Response: ${response.requestId} (Status: ${response.status})`,
    );

    const subject = this.responseSubjects.get(response.requestId);
    if (subject) {
      subject.next(response);
      subject.complete();
      this.responseSubjects.delete(response.requestId);
    }
  }

  async broadcastRequest(
    requestData: IncomingRequest,
    targetTunnelId: string,
  ): Promise<OutgoingResponse> {
    const responseSubject = new Subject<OutgoingResponse>();
    this.responseSubjects.set(requestData.requestId, responseSubject);

    console.log(
      `🚀 [Server] Sending Request to CLI (Tunnel: ${targetTunnelId}): ${requestData.requestId}`,
    );

    const roomSize =
      this.server.sockets.adapter.rooms.get(targetTunnelId)?.size || 0;

    if (roomSize === 0) {
      this.responseSubjects.delete(requestData.requestId);
      console.warn(`⚠️ No CLI connected for tunnel: ${targetTunnelId}`);
      throw new Error(`Tunnel ${targetTunnelId} is not connected`);
    }

    this.server
      .to(targetTunnelId)
      .emit(TUNNEL_EVENTS.REQUEST_INCOMING, requestData);

    try {
      return await firstValueFrom(responseSubject.pipe(timeout(60000)));
    } catch (error) {
      this.responseSubjects.delete(requestData.requestId);
      console.error(
        `💀 [Server] Timeout waiting for ID: ${requestData.requestId}`,
      );
      throw error;
    }
  }

  broadcastLog(log: RequestLog): void {
    this.server.emit(TUNNEL_EVENTS.NEW_LOG, log);
  }
}
