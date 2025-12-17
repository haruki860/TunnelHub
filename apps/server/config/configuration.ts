import { ConfigFactory } from '@nestjs/config';

export const configuration: ConfigFactory = () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  webUrl: process.env.WEB_URL || 'http://localhost:3001',
  // 必要に応じてDB設定などもここに追加
});
