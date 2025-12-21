-- DropForeignKey
ALTER TABLE "RequestLog" DROP CONSTRAINT "RequestLog_tunnelId_fkey";

-- AlterTable
ALTER TABLE "RequestLog" ADD COLUMN     "body" JSONB,
ADD COLUMN     "headers" JSONB,
ADD COLUMN     "query" JSONB;

-- AddForeignKey
ALTER TABLE "RequestLog" ADD CONSTRAINT "RequestLog_tunnelId_fkey" FOREIGN KEY ("tunnelId") REFERENCES "Tunnel"("subdomain") ON DELETE RESTRICT ON UPDATE CASCADE;
