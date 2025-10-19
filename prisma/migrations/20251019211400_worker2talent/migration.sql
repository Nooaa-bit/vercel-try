/*
  Warnings:

  - The values [worker] on the enum `role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "role_new" AS ENUM ('superadmin', 'company_admin', 'supervisor', 'talent');
ALTER TABLE "user_company_role" ALTER COLUMN "role" TYPE "role_new" USING ("role"::text::"role_new");
ALTER TABLE "invitation" ALTER COLUMN "role" TYPE "role_new" USING ("role"::text::"role_new");
ALTER TYPE "role" RENAME TO "role_old";
ALTER TYPE "role_new" RENAME TO "role";
DROP TYPE "public"."role_old";
COMMIT;
