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
    const type = client.handshake.query.type as string; // 'dashboard' かどうか
    const password = client.handshake.auth.password as string;

    if (tunnelId) {
      // ★変更: ダッシュボード（閲覧者）の場合
      if (type === 'dashboard') {
        await client.join(tunnelId);
        console.log(`👀 Dashboard connected to room: ${tunnelId}`);
        return;
      }

      // --- 以下、CLI (Host) の接続処理 ---

      // 重複チェック
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
    // CLIが切断された場合のみマップから削除
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

    // CLIが接続されているか確認
    if (!this.tunnelConnections.has(targetTunnelId)) {
      this.responseSubjects.delete(requestData.requestId);
      throw new Error(`Tunnel ${targetTunnelId} is not connected`);
    }

    // CLIへリクエスト送信 (HostのSocketIDを特定して送る)
    const hostSocketId = this.tunnelConnections.get(targetTunnelId)?.socketId;
    if (hostSocketId) {
      this.server
        .to(hostSocketId)
        .emit(TUNNEL_EVENTS.REQUEST_INCOMING, requestData);
    }

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

  // ★変更: ログを指定された部屋(tunnelId)だけに送る
  broadcastLog(tunnelId: string, log: RequestLog): void {
    this.server.to(tunnelId).emit(TUNNEL_EVENTS.NEW_LOG, log);
  }
}
