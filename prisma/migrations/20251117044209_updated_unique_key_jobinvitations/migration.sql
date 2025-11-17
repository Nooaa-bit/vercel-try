/*
  Warnings:

  - A unique constraint covering the columns `[shift_id,user_id,deleted_at]` on the table `shift_assignment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."shift_user_unique";

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignment_shift_id_user_id_deleted_at_key" ON "shift_assignment"("shift_id", "user_id", "deleted_at");
