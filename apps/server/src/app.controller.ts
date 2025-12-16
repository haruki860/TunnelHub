import { Controller, All, Req, Body, Query, Res } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { IncomingRequest } from '@tunnel-hub/shared';
import { Response } from 'express';
import { randomUUID } from 'crypto';

@Controller()
export class AppController {
  constructor(private readonly eventsGateway: EventsGateway) {}

  @All('*')
  async receiveHttp(
    @Req() req,
    @Body() body,
    @Query() query,
    @Res() res: Response,
  ) {
    console.log(`🌍 HTTP Request Came: ${req.method} ${req.url}`);

    // リクエストIDを生成
    const requestId = randomUUID();

    const requestData: IncomingRequest = {
      requestId,
      method: req.method,
      path: req.url,
      body: body,
      query: query,
      headers: req.headers as Record<string, string>,
    };

    try {
      // Gatewayのメソッドを呼び、レスポンスを待機
      const response = await this.eventsGateway.broadcastRequest(requestData);

      // レスポンスヘッダーを設定
      Object.entries(response.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // ステータスコードとボディを設定して返す
      res.status(response.statusCode);

      // Content-Typeによって返し方を変える
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        res.json(response.body);
      } else {
        res.send(response.body);
      }
    } catch (error) {
      console.error('❌ Error waiting for response:', error);
      res.status(504).json({
        error: 'Gateway Timeout',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
