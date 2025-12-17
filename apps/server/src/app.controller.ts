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

    // ヘッダー変換
    const safeHeaders = Object.entries(req.headers).reduce(
      (acc, [key, value]) => {
        if (typeof value === 'string') acc[key] = value;
        else if (Array.isArray(value)) acc[key] = value.join(',');
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
      const clientResponse =
        await this.eventsGateway.broadcastRequest(requestData);

      // ヘッダー設定
      if (clientResponse.headers) {
        Object.entries(clientResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }

      res.status(clientResponse.status);

      // ★バイナリ対応: Bufferならそのままsend、それ以外はJSON判定
      const body = clientResponse.body;
      if (Buffer.isBuffer(body)) {
        res.send(body);
      } else if (typeof body === 'object') {
        res.json(body);
      } else {
        res.send(body);
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
      console.error(`❌ Request Failed: ${error}`);
      res.status(504).json({ error: 'Gateway Timeout' });

      this.eventsGateway.broadcastLog({
        requestId,
        method: req.method,
        path: requestPath,
        status: 504,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
