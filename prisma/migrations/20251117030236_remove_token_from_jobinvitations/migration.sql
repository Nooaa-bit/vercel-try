/*
  Warnings:

  - You are about to drop the column `token` on the `job_invitation` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."job_invitation_token_key";

-- AlterTable
ALTER TABLE "job_invitation" DROP COLUMN "token";
