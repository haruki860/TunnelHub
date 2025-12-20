import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service'; // 後で作ります

@Injectable()
export class LogCleanupService {
  private readonly logger = new Logger(LogCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 毎日深夜0時に実行
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleLogCleanup() {
    this.logger.debug('🧹 Starting old logs cleanup...');

    // 3日前の日付を計算
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 3);

    try {
      const result = await this.prisma.requestLog.deleteMany({
        where: {
          timestamp: {
            lt: dateLimit, // lt = less than (これより古い)
          },
        },
      });
      this.logger.log(`🗑️  Deleted ${result.count} old logs.`);
    } catch (e) {
      this.logger.error('Failed to cleanup logs', e);
    }
  }
}
