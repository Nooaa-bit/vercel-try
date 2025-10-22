-- CreateEnum
CREATE TYPE "location_type" AS ENUM ('Office', 'Warehouse', 'RetailStore', 'Restaurant', 'EventSpace', 'ConstructionSite', 'Factory', 'HealthcareFacility', 'Hotel', 'Educational', 'Other');

-- CreateTable
CREATE TABLE "location" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "location_type" NOT NULL DEFAULT 'Other',
    "address" VARCHAR(500) NOT NULL,
    "address_line_2" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100),
    "postcode" VARCHAR(20),
    "country" VARCHAR(100) NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "access_instructions" TEXT,
    "contact_phone" VARCHAR(50),
    "contact_email" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_company_id_deleted_at_idx" ON "location"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "location_latitude_longitude_idx" ON "location"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
