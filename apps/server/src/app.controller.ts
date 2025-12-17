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

    if (req.headers['x-tunnel-id']) {
      targetTunnelId = req.headers['x-tunnel-id'] as string;
    }

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
      if (req.path.startsWith('/socket.io')) return;

      const webUrl =
        this.configService.get<string>('webUrl') || 'http://localhost:3001';
      const protocol = req.protocol;
      const host = req.get('host');
      const originalFullUrl = `${protocol}://${host}${req.originalUrl}`;

      res.redirect(
        `${webUrl}/entry?returnUrl=${encodeURIComponent(originalFullUrl)}`,
      );
      return;
    }

    // 3. トンネル情報の取得と接続チェック
    const tunnelInfo = this.eventsGateway.getTunnelInfo(targetTunnelId);

    if (!tunnelInfo) {
      res.status(502).json({
        error: 'Bad Gateway',
        message: `Tunnel ID "${targetTunnelId}" is not connected.`,
      });
      return;
    }

    // ★修正: パスワード認証 (Basic Auth)
    if (tunnelInfo.password) {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Tunnel Protected"');
        res.status(401).send('Authentication required');
        return;
      }

      const match = authHeader.match(/^Basic (.+)$/);
      if (!match) {
        res.status(401).send('Invalid Authorization header');
        return;
      }

      const credentials = Buffer.from(match[1], 'base64').toString('utf-8');

      // ★ここが変わりました: user変数を作らずにスキップします
      const [, pass] = credentials.split(':');

      if (pass !== tunnelInfo.password) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Tunnel Protected"');
        res.status(401).send('Invalid password');
        return;
      }
    }

    // 4. リクエスト転送処理
    const safeHeaders = Object.entries(req.headers).reduce(
      (acc, [key, value]) => {
        if (typeof value === 'string') acc[key] = value;
        else if (Array.isArray(value)) acc[key] = value.join(',');
        return acc;
      },
      {} as Record<string, string>,
    );

    delete safeHeaders['authorization'];

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

      if (!res.headersSent) {
        res.status(504).json({
          error: 'Gateway Timeout',
          message: `Tunnel ID "${targetTunnelId}" failed to respond.`,
        });
      }

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
