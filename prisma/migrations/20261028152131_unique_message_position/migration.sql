/*
  Warnings:

  - A unique constraint covering the columns `[conversationId,position]` on the table `Message` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Message_conversationId_position_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_position_key" ON "Message"("conversationId", "position");
