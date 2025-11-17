/*
  Warnings:

  - You are about to drop the column `expires_at` on the `job_invitation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `job_invitation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."job_invitation_job_id_status_idx";

-- DropIndex
DROP INDEX "public"."job_invitation_user_id_status_idx";

-- AlterTable
ALTER TABLE "job_invitation" DROP COLUMN "expires_at",
ADD COLUMN     "shift_ids" INTEGER[],
ADD COLUMN     "spots_filled_at" TIMESTAMPTZ(6),
ADD COLUMN     "token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "job_invitation_token_key" ON "job_invitation"("token");

-- CreateIndex
CREATE INDEX "job_invitation_shift_ids_idx" ON "job_invitation"("shift_ids");
