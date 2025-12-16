import { Controller, All, Req, Body, Query } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { IncomingRequest } from '@tunnel-hub/shared';

@Controller()
export class AppController {
  constructor(private readonly eventsGateway: EventsGateway) {}

  @All('*')
  receiveHttp(@Req() req, @Body() body, @Query() query) {
    console.log(`🌍 HTTP Request Came: ${req.method} ${req.url}`);

    const requestData: IncomingRequest = {
      method: req.method,
      path: req.url,
      body: body,
      query: query,
    };

    // Gatewayのメソッドを呼ぶ
    this.eventsGateway.broadcastRequest(requestData);

    return 'Request sent to CLI!';
  }
}