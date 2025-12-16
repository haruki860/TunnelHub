import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
// sharedから読み込み
import {
  TUNNEL_EVENTS,
  IncomingRequest,
  OutgoingResponse,
} from '@tunnel-hub/shared';
import { Subject, firstValueFrom } from 'rxjs';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // リクエストIDとレスポンスSubjectの対応表
  private responseSubjects = new Map<string, Subject<OutgoingResponse>>();

  handleConnection(client: Socket) {
    console.log(`Client Connected: ${client.id}`);

    // レスポンス受信イベントをリッスン
    client.on(TUNNEL_EVENTS.RESPONSE_OUTGOING, (response: OutgoingResponse) => {
      this.handleResponse(response);
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`Client Disconnected: ${client.id}`);
  }

  // レスポンスを受信した時の処理
  private handleResponse(response: OutgoingResponse) {
    const subject = this.responseSubjects.get(response.requestId);
    if (subject) {
      console.log(
        `📥 Received response for request ${response.requestId}: ${response.statusCode}`,
      );
      subject.next(response);
      subject.complete();
      this.responseSubjects.delete(response.requestId);
    } else {
      console.warn(
        `⚠️ Received response for unknown request ID: ${response.requestId}`,
      );
    }
  }

  // Controllerから呼ばれるメソッド（Promiseを返す）
  async broadcastRequest(
    requestData: IncomingRequest,
  ): Promise<OutgoingResponse> {
    // レスポンス待機用のSubjectを作成
    const responseSubject = new Subject<OutgoingResponse>();
    this.responseSubjects.set(requestData.requestId, responseSubject);

    console.log(
      `🚀 Sending request to CLI (Request ID: ${requestData.requestId})...`,
    );

    // CLIにリクエストを送信
    this.server.emit(TUNNEL_EVENTS.REQUEST_INCOMING, requestData);

    // レスポンスが来るまで待機（タイムアウト30秒）
    try {
      const response = await Promise.race([
        firstValueFrom(responseSubject),
        new Promise<OutgoingResponse>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 30000),
        ),
      ]);
      return response;
    } catch (error) {
      // タイムアウト時は待機中だったSubjectを削除
      this.responseSubjects.delete(requestData.requestId);
      throw error;
    }
  }
}
