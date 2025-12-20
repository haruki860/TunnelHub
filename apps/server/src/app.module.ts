import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { EventsGateway } from './events.gateway';
import { configuration } from '../config/configuration';
import { LogCleanupService } from './tasks/log-cleanup.service'; // ★追加
import { ScheduleModule } from '@nestjs/schedule'; // ★追加: 定期実行用
import { PrismaService } from './prisma.service'; // ★追加

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration], // 型アサーションを追加
      envFilePath:
        process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [EventsGateway, PrismaService, LogCleanupService],
})
export class AppModule {}
