import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ★追加: CORSを許可する（これがないとFrontendから繋がりません）
  app.enableCors({
    origin: '*', // 開発用なので全許可にしていますが、本番ではURLを指定します
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error) => {
  console.error('Error starting the application:', error);
  process.exit(1);
});
