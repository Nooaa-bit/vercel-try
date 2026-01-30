-- AlterTable
ALTER TABLE "job" ADD COLUMN     "check_in_radius_meters" INTEGER,
ADD COLUMN     "check_in_window_minutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "hourly_rate" DECIMAL(10,2),
ADD COLUMN     "shift_rate" DECIMAL(10,2);
