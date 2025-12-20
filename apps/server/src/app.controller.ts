import {
  Controller,
  All,
  Req,
  Body,
  Query,
  Res,
  Get,
  Param,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventsGateway } from './events.gateway';
import { PrismaService } from './prisma.service';
import { IncomingRequest } from '@tunnel-hub/shared';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Controller()
export class AppController {
  constructor(
    private readonly eventsGateway: EventsGateway,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // 過去ログ取得API
  @Get('api/logs/:tunnelId')
  async getLogs(@Param('tunnelId') tunnelId: string) {
    const logs = await this.prisma.requestLog.findMany({
      where: {
        tunnel: {
          subdomain: tunnelId,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 50,
    });
    return logs;
  }

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

    // ノイズ除去リスト
    const IGNORED_EXTENSIONS = [
      '.ico',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.css',
      '.js',
      '.map',
      '.woff',
      '.woff2',
      '.ttf',
    ];

    const isIgnoredLog =
      IGNORED_EXTENSIONS.some((ext) => requestPath.endsWith(ext)) ||
      requestPath.includes('/_next/') ||
      requestPath.includes('/static/');

    // 1. Tunnel IDの特定
    let targetTunnelId = '';

    // A. クエリパラメータからの取得
    if (req.query['tunnel_id']) {
      const incomingId = req.query['tunnel_id'] as string;

      res.setHeader(
        'Set-Cookie',
        `tunnel_id=${incomingId}; Path=/; HttpOnly; Max-Age=86400; SameSite=Lax`,
      );

      // ★修正: URLオブジェクトを使って安全にtunnel_idだけを削除 (ループ処理を廃止)
      const protocol = req.protocol;
      const host = req.get('host') || 'localhost';
      const cleanUrl = new URL(req.originalUrl, `${protocol}://${host}`);

      // パラメータ削除
      cleanUrl.searchParams.delete('tunnel_id');

      res.redirect(cleanUrl.toString());
      return;
    }

    // B. ヘッダー
    if (req.headers['x-tunnel-id']) {
      targetTunnelId = req.headers['x-tunnel-id'] as string;
    }

    // C. Cookie
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

    // 2. IDがない場合
    if (!targetTunnelId) {
      if (req.path.startsWith('/socket.io')) return;
      if (req.path.startsWith('/api/logs')) return;

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

    // 3. トンネル接続チェック
    const tunnelInfo = this.eventsGateway.getTunnelInfo(targetTunnelId);

    if (!tunnelInfo) {
      console.log(
        `⚠️ Tunnel ID "${targetTunnelId}" not found. Clearing cookie and redirecting.`,
      );

      res.setHeader(
        'Set-Cookie',
        'tunnel_id=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      );

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

    // 4. パスワード認証
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
      const [, pass] = credentials.split(':');

      if (pass !== tunnelInfo.password) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Tunnel Protected"');
        res.status(401).send('Invalid password');
        return;
      }
    }

    // 5. 転送処理
    const safeHeaders = Object.entries(req.headers).reduce(
      (acc, [key, value]) => {
        if (typeof value === 'string') acc[key] = value;
        else if (Array.isArray(value)) acc[key] = value.join(',');
        return acc;
      },
      {} as Record<string, string>,
    );

    delete safeHeaders['authorization'];
    delete safeHeaders['cookie'];

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

      // ログ保存 (voidで待たずに実行)
      if (!isIgnoredLog) {
        void this.eventsGateway.broadcastLog(targetTunnelId, {
          requestId,
          method: req.method,
          path: requestPath,
          status: clientResponse.status,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`❌ Request Failed for ${targetTunnelId}:`, error);

      if (!res.headersSent) {
        res.status(504).json({
          error: 'Gateway Timeout',
          message: `Tunnel ID "${targetTunnelId}" failed to respond.`,
        });
      }

      if (!isIgnoredLog) {
        void this.eventsGateway.broadcastLog(targetTunnelId, {
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
}
