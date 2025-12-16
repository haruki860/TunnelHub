import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // 開発用：どこからでも接続OKにする
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // クライアント（CLI）が接続した時
  handleConnection(client: Socket) {
    console.log(`Client Connected: ${client.id}`);
  }

  // クライアントが切断した時
  handleDisconnect(client: Socket) {
    console.log(`Client Disconnected: ${client.id}`);
  }
}
