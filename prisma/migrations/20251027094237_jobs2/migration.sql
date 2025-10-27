/*
  Warnings:

  - You are about to drop the `contact_messages` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "seniority" AS ENUM ('junior', 'senior');

-- CreateEnum
CREATE TYPE "check_method" AS ENUM ('app_self', 'manual', 'ai_agent');

-- CreateEnum
CREATE TYPE "export_request_type" AS ENUM ('full_data', 'job_history', 'ratings');

-- CreateEnum
CREATE TYPE "consent_type" AS ENUM ('data_processing', 'performance_ratings', 'marketing', 'third_party_sharing', 'location_tracking');

-- CreateEnum
CREATE TYPE "access_type" AS ENUM ('view', 'edit', 'delete', 'export', 'automated_decision');

-- DropIndex
DROP INDEX "public"."invitation_company_id_idx";

-- DropIndex
DROP INDEX "public"."invitation_email_idx";

-- DropIndex
DROP INDEX "public"."location_company_id_deleted_at_idx";

-- DropIndex
DROP INDEX "public"."location_latitude_longitude_idx";

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "anonymized_at" TIMESTAMP(3),
ADD COLUMN     "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_at" TIMESTAMP(3);

-- DropTable
DROP TABLE "public"."contact_messages";

-- CreateTable
CREATE TABLE "contact_message" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "position" VARCHAR(255) NOT NULL,
    "seniority" "seniority" NOT NULL,
    "description" TEXT,
    "workers_needed" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" INTEGER,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "shift_date" DATE NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "workers_needed" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignment" (
    "id" SERIAL NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" INTEGER NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by" INTEGER,
    "cancellation_reason" TEXT,
    "marked_no_show_at" TIMESTAMPTZ(6),
    "marked_no_show_by" INTEGER,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "shift_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in_out" (
    "id" SERIAL NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "check_in_time" TIMESTAMPTZ(6),
    "check_in_method" "check_method",
    "checked_in_by" INTEGER,
    "check_in_location" TEXT,
    "check_out_time" TIMESTAMPTZ(6),
    "check_out_method" "check_method",
    "checked_out_by" INTEGER,
    "check_out_location" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_in_out_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_rating" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "rated_by" INTEGER NOT NULL,
    "rated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "job_rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consent" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "consent_type" "consent_type" NOT NULL,
    "purpose" TEXT NOT NULL,
    "given_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,

    CONSTRAINT "user_consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_request" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "request_type" "export_request_type" NOT NULL,
    "file_url" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,

    CONSTRAINT "data_export_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_access_log" (
    "id" SERIAL NOT NULL,
    "accessed_by" INTEGER NOT NULL,
    "subject_user_id" INTEGER NOT NULL,
    "access_type" "access_type" NOT NULL,
    "resourceType" VARCHAR(100) NOT NULL,
    "resource_id" INTEGER,
    "accessed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,

    CONSTRAINT "data_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_policy" (
    "id" SERIAL NOT NULL,
    "dataType" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "retention_days" INTEGER NOT NULL,
    "last_checked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_retention_policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_user_unique" ON "shift_assignment"("shift_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_user_rating_unique" ON "job_rating"("job_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_retention_policy_dataType_key" ON "data_retention_policy"("dataType");

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job" ADD CONSTRAINT "job_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "shift_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shift_assignment" ADD CONSTRAINT "shift_assignment_marked_no_show_by_fkey" FOREIGN KEY ("marked_no_show_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "check_in_out" ADD CONSTRAINT "check_in_out_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "shift_assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in_out" ADD CONSTRAINT "check_in_out_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "check_in_out" ADD CONSTRAINT "check_in_out_checked_out_by_fkey" FOREIGN KEY ("checked_out_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "job_rating" ADD CONSTRAINT "job_rating_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_rating" ADD CONSTRAINT "job_rating_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_rating" ADD CONSTRAINT "job_rating_rated_by_fkey" FOREIGN KEY ("rated_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consent" ADD CONSTRAINT "user_consent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_request" ADD CONSTRAINT "data_export_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_log" ADD CONSTRAINT "data_access_log_accessed_by_fkey" FOREIGN KEY ("accessed_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_log" ADD CONSTRAINT "data_access_log_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
