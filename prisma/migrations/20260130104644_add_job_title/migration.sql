/*
  Warnings:

  - You are about to alter the column `position` on the `job` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(100)`.

*/
-- AlterTable
ALTER TABLE "job" ADD COLUMN     "title" VARCHAR(255),
ALTER COLUMN "position" SET DATA TYPE VARCHAR(100);
