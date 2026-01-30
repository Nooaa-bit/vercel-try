/*
  Warnings:

  - You are about to drop the column `check_in_radius_meters` on the `job` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "job" DROP COLUMN "check_in_radius_meters",
ADD COLUMN     "check_in_radius_job" INTEGER;
