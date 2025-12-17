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
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // リクエストIDとレスポンス待機用Subjectの対応表
  private responseSubjects = new Map<string, Subject<OutgoingResponse>>();

  handleConnection(client: Socket) {
    console.log(`Client Connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client Disconnected: ${client.id}`);
  }

  // ★修正: client.on ではなく NestJS のデコレーターを使う
  @SubscribeMessage(TUNNEL_EVENTS.RESPONSE_OUTGOING)
  handleResponse(@MessageBody() response: OutgoingResponse): void {
    const subject = this.responseSubjects.get(response.requestId);

    if (subject) {
      // 待機中のリクエストがあれば、値を流して完了させる
      subject.next(response);
      subject.complete(); // 重要: 購読を終了させる
      this.responseSubjects.delete(response.requestId);
    }
  }

  // Controllerから呼ばれるメソッド（Promiseを返す）
  // ★ここがポイント: Controller側での複雑な処理を不要にする神メソッド
  async broadcastRequest(
    requestData: IncomingRequest,
  ): Promise<OutgoingResponse> {
    const responseSubject = new Subject<OutgoingResponse>();
    this.responseSubjects.set(requestData.requestId, responseSubject);

    // CLIにリクエスト送信
    this.server.emit(TUNNEL_EVENTS.REQUEST_INCOMING, requestData);

    try {
      // 30秒待つ（RxJSの機能で待機）
      return await firstValueFrom(responseSubject.pipe(timeout(30000)));
    } catch (error) {
      // タイムアウト時はマップから削除してエラーを投げる
      this.responseSubjects.delete(requestData.requestId);
      throw error;
    }
  }

  broadcastLog(log: RequestLog): void {
    this.server.emit(TUNNEL_EVENTS.NEW_LOG, log);
  }
}
