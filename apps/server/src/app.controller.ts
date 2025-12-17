// apps/server/src/app.controller.ts
import { Controller, All, Req, Body, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventsGateway } from './events.gateway';
import { IncomingRequest } from '@tunnel-hub/shared';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Controller()
export class AppController {
  constructor(
    private readonly eventsGateway: EventsGateway,
    private readonly configService: ConfigService,
  ) {}

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

    // 1. Tunnel IDの特定
    let targetTunnelId = '';

    // A. URLクエリパラメータから (tunnel_id) - 最優先
    if (req.query.tunnel_id && typeof req.query.tunnel_id === 'string') {
      targetTunnelId = req.query.tunnel_id;

      // クエリパラメータで取得した場合、Cookieにも保存してリダイレクト
      res.cookie('tunnel_id', targetTunnelId, {
        maxAge: 86400000, // 1日
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
      });

      // クエリパラメータを削除してリダイレクト
      const cleanUrl = req.originalUrl
        .replace(/[?&]tunnel_id=[^&]+/, '')
        .replace(/\?$/, '');
      res.redirect(cleanUrl || '/');
      return;
    }

    // B. ヘッダーから (x-tunnel-id)
    if (!targetTunnelId && req.headers['x-tunnel-id']) {
      targetTunnelId = req.headers['x-tunnel-id'] as string;
    }

    // C. Cookieから (tunnel_id)
    if (!targetTunnelId && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce(
        (acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>,
      );

      if (cookies['tunnel_id']) {
        targetTunnelId = cookies['tunnel_id'];
      }
    }

    // 2. IDがない場合: Web側の入力画面へリダイレクト
    if (!targetTunnelId) {
      const webUrl = this.configService.get<string>('webUrl');

      const protocol = req.protocol;
      const host = req.get('host');
      const originalFullUrl = `${protocol}://${host}${req.originalUrl}`;

      // Web側の /entry ページへ飛ばす
      res.redirect(
        `${webUrl}/entry?returnUrl=${encodeURIComponent(originalFullUrl)}`,
      );
      return;
    }

    // 3. リクエスト転送処理
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
      const clientResponse = await this.eventsGateway.broadcastRequest(
        requestData,
        targetTunnelId,
      );

      if (clientResponse.headers) {
        Object.entries(clientResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }

      res.status(clientResponse.status);

      const body = clientResponse.body;
      if (Buffer.isBuffer(body)) {
        res.send(body);
      } else if (typeof body === 'object') {
        res.json(body);
      } else {
        res.send(body);
      }

      this.eventsGateway.broadcastLog({
        requestId,
        method: req.method,
        path: requestPath,
        status: clientResponse.status,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`❌ Request Failed for ${targetTunnelId}:`, error);
      res.status(502).json({
        error: 'Bad Gateway',
        message: `Tunnel ID "${targetTunnelId}" is not connected or timed out.`,
      });

      this.eventsGateway.broadcastLog({
        requestId,
        method: req.method,
        path: requestPath,
        status: 502,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
