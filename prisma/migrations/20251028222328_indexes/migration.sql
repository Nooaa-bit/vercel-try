-- CreateIndex
CREATE INDEX "idx_invitation_active" ON "invitation"("company_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_invitation_lookup" ON "invitation"("email", "status");

-- CreateIndex
CREATE INDEX "idx_job_active" ON "job"("company_id", "deleted_at", "start_date");

-- CreateIndex
CREATE INDEX "location_company_id_deleted_at_idx" ON "location"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_shift_schedule" ON "shift"("job_id", "shift_date", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_assignment_user_status" ON "shift_assignment"("user_id", "cancelled_at", "marked_no_show_at");

-- CreateIndex
CREATE INDEX "idx_assignment_shift_active" ON "shift_assignment"("shift_id", "cancelled_at", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_user_active_sorted" ON "user"("deleted_at", "first_name");

-- CreateIndex
CREATE INDEX "idx_ucr_company_active" ON "user_company_role"("company_id", "revoked_at");
