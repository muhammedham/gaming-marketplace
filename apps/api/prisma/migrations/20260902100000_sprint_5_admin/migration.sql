CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "users"
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "categories"
  ADD COLUMN "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "games"
  ADD COLUMN "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "system_settings"
  ADD COLUMN "auto_confirmation_hours" DECIMAL(9,4) NOT NULL DEFAULT 24;

CREATE TABLE "admin_audit_logs" (
  "id" SERIAL NOT NULL,
  "admin_id" UUID NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "entity_type" VARCHAR(40) NOT NULL,
  "entity_id" VARCHAR(100) NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "admin_audit_logs"
  ADD CONSTRAINT "admin_audit_logs_admin_id_fkey"
  FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "admin_audit_logs_admin_id_created_at_idx"
  ON "admin_audit_logs"("admin_id", "created_at");

CREATE INDEX "admin_audit_logs_entity_type_entity_id_created_at_idx"
  ON "admin_audit_logs"("entity_type", "entity_id", "created_at");
