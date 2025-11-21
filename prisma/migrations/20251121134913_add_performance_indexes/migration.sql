-- CreateEnum
CREATE TYPE "cancellation_reason" AS ENUM ('other_job', 'personal', 'sick', 'accident', 'bad_performance', 'day_off', 'admin_decision');

-- CreateIndex
CREATE INDEX "idx_job_date_range" ON "job"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "idx_invitation_job_status" ON "job_invitation"("job_id", "status");

-- CreateIndex
CREATE INDEX "idx_invitation_user_status" ON "job_invitation"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_shift_date_active" ON "shift"("shift_date", "deleted_at");

-- RenameIndex
ALTER INDEX "job_invitation_shift_ids_idx" RENAME TO "idx_invitation_shifts";
