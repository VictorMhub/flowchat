-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "position" INTEGER;

-- CreateIndex
CREATE INDEX "Message_conversationId_position_idx" ON "Message"("conversationId", "position");
