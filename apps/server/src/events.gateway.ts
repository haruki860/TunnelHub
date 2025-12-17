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

@WebSocketGateway({
  cors: { origin: '*' },
  maxHttpBufferSize: 50 * 1024 * 1024,
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private responseSubjects = new Map<string, Subject<OutgoingResponse>>();
  // Tunnel ID と Socket ID のマッピング（必要に応じて使用）
  private tunnelConnections = new Map<string, string>();

  async handleConnection(client: Socket) {
    // クエリから tunnelId を取得
    const tunnelId = client.handshake.query.tunnelId as string;
    // Authからパスワードを取得（今後のPhase 2で使用）
    const password = client.handshake.auth.password as string;

    if (tunnelId) {
      // Socket.io の Room 機能を使って、tunnelId の部屋に入れる
      await client.join(tunnelId);
      this.tunnelConnections.set(tunnelId, client.id);

      console.log(`✅ Client Connected: ${client.id} (Tunnel ID: ${tunnelId})`);

      if (password) {
        console.log(`🔒 Secured with password`);
      }
    } else {
      console.log(`⚠️ Client Connected without Tunnel ID: ${client.id}`);
      // IDがない場合、切断するか、ランダムな部屋に入れる等の処理
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client Disconnected: ${client.id}`);
    // マップから削除するなどのクリーンアップ（必要であれば）
    for (const [tid, sid] of this.tunnelConnections.entries()) {
      if (sid === client.id) {
        this.tunnelConnections.delete(tid);
        break;
      }
    }
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

  // 変更点: tunnelId を引数に追加し、特定のCLIだけにリクエストを送る
  async broadcastRequest(
    requestData: IncomingRequest,
    targetTunnelId: string,
  ): Promise<OutgoingResponse> {
    const responseSubject = new Subject<OutgoingResponse>();
    this.responseSubjects.set(requestData.requestId, responseSubject);

    console.log(
      `🚀 [Server] Sending Request to CLI (Tunnel: ${targetTunnelId}): ${requestData.requestId}`,
    );

    // 全員への broadcast ではなく、特定の部屋（tunnelId）だけに送信
    const roomSize =
      this.server.sockets.adapter.rooms.get(targetTunnelId)?.size || 0;

    if (roomSize === 0) {
      this.responseSubjects.delete(requestData.requestId);
      console.warn(`⚠️ No CLI connected for tunnel: ${targetTunnelId}`);
      // CLIが繋がっていない場合のエラーレスポンスを即座に返す等の処理が可能
      throw new Error(`Tunnel ${targetTunnelId} is not connected`);
    }

    // 特定のTunnel IDの部屋にだけ送信
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
    // ログも特定の部屋（ダッシュボード用）に送るべきですが、
    // 現状は全員に送るか、tunnelIdを含むログとして全配信してフロントでフィルタリングします。
    this.server.emit(TUNNEL_EVENTS.NEW_LOG, log);
  }
}
