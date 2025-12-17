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
  // ★重要: データサイズ制限を50MBまで引き上げ（これがないと大きなJSファイルで切断されます）
  maxHttpBufferSize: 50 * 1024 * 1024,
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private responseSubjects = new Map<string, Subject<OutgoingResponse>>();

  handleConnection(client: Socket) {
    console.log(`✅ Client Connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client Disconnected: ${client.id}`);
  }

  @SubscribeMessage(TUNNEL_EVENTS.RESPONSE_OUTGOING)
  handleResponse(@MessageBody() response: OutgoingResponse): void {
    // デバッグログ（データサイズが大きすぎるとログが見にくいのでIDだけ表示）
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
  ): Promise<OutgoingResponse> {
    const responseSubject = new Subject<OutgoingResponse>();
    this.responseSubjects.set(requestData.requestId, responseSubject);

    console.log(`🚀 [Server] Sending Request to CLI: ${requestData.requestId}`);
    this.server.emit(TUNNEL_EVENTS.REQUEST_INCOMING, requestData);

    try {
      // タイムアウトを少し長めに（60秒）
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
