import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
// sharedから読み込み
import { TUNNEL_EVENTS, IncomingRequest } from '@tunnel-hub/shared';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client Connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client Disconnected: ${client.id}`);
  }

  // Controllerから呼ばれるメソッド
  broadcastRequest(requestData: IncomingRequest) {
    console.log('🚀 Sending request to CLI...');
    // 定数を使ってイベント送信
    this.server.emit(TUNNEL_EVENTS.REQUEST_INCOMING, requestData);
  }
}
