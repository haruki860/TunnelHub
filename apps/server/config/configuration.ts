import { ConfigFactory } from '@nestjs/config';

export const configuration: ConfigFactory = () => {
  // 本番環境かどうかを判定
  const isProduction = process.env.NODE_ENV === 'production';

  // デフォルトのWebURL（本番環境では空文字列にしてエラーを防ぐ）
  const defaultWebUrl = isProduction
    ? 'https://tunnel-hub-web.vercel.app/'
    : 'http://localhost:3001';

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    webUrl: process.env.WEB_URL || defaultWebUrl,
    // 必要に応じてDB設定などもここに追加
  };
};
