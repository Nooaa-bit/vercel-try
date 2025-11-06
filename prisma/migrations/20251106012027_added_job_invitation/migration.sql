-- CreateEnum
CREATE TYPE "job_invitation_status" AS ENUM ('pending', 'accepted', 'declined', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "job_invitation" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "invited_by" INTEGER NOT NULL,
    "status" "job_invitation_status" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_invitation_job_id_status_idx" ON "job_invitation"("job_id", "status");

-- CreateIndex
CREATE INDEX "job_invitation_user_id_status_idx" ON "job_invitation"("user_id", "status");

-- AddForeignKey
ALTER TABLE "job_invitation" ADD CONSTRAINT "job_invitation_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_invitation" ADD CONSTRAINT "job_invitation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_invitation" ADD CONSTRAINT "job_invitation_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
