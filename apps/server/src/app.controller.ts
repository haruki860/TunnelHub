import { Controller, All, Req, Body, Query, Res } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { IncomingRequest } from '@tunnel-hub/shared';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Controller()
export class AppController {
  constructor(private readonly eventsGateway: EventsGateway) {}

  @All('*')
  async receiveHttp(
    @Req() req: Request,
    @Body() body: unknown,
    @Query() query: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = uuidv4();
    const requestPath = req.originalUrl || req.url || '/';

    console.log(
      `🌍 HTTP Request: ${req.method} ${requestPath} (ID: ${requestId})`,
    );

    // ヘッダーの型変換
    const safeHeaders = Object.entries(req.headers).reduce(
      (acc, [key, value]) => {
        if (typeof value === 'string') {
          acc[key] = value;
        } else if (Array.isArray(value)) {
          acc[key] = value.join(',');
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    const requestData: IncomingRequest = {
      requestId,
      method: req.method,
      path: requestPath,
      body,
      query,
      headers: safeHeaders,
    };

    try {
      // ★超シンプル化: Gatewayを呼ぶだけ！待機処理はGatewayがやってくれる
      const clientResponse =
        await this.eventsGateway.broadcastRequest(requestData);

      // レスポンス処理
      if (clientResponse.headers) {
        Object.entries(clientResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }

      res.status(clientResponse.status);

      const contentType = clientResponse.headers?.['content-type'] || '';
      if (
        contentType.includes('application/json') &&
        typeof clientResponse.body === 'object'
      ) {
        res.json(clientResponse.body);
      } else {
        res.send(clientResponse.body);
      }

      // ログ送信
      this.eventsGateway.broadcastLog({
        requestId,
        method: req.method,
        path: requestPath,
        status: clientResponse.status,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // タイムアウト等のエラー処理
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown Error';
      console.error(`❌ Request Failed: ${errorMessage}`);

      this.eventsGateway.broadcastLog({
        requestId,
        method: req.method,
        path: requestPath,
        status: 504,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'The tunnel client did not respond in time.',
      });
    }
  }
}
