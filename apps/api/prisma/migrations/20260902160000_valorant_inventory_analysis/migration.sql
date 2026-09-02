CREATE TYPE "InventoryAnalysisStatus" AS ENUM (
  'AWAITING_UPLOAD',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'EXPIRED'
);

CREATE TABLE "game_inference_integrations" (
  "id" UUID NOT NULL,
  "game_id" UUID NOT NULL,
  "provider" VARCHAR(40) NOT NULL DEFAULT 'RUNPOD',
  "endpoint_id" VARCHAR(160),
  "api_key_encrypted" TEXT,
  "api_key_last_four" VARCHAR(4),
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "game_inference_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_analyses" (
  "id" UUID NOT NULL,
  "listing_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "game_id" UUID NOT NULL,
  "status" "InventoryAnalysisStatus" NOT NULL DEFAULT 'AWAITING_UPLOAD',
  "storage_key" VARCHAR(500) NOT NULL,
  "original_file_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "provider_job_id" VARCHAR(160),
  "raw_response" JSONB,
  "output" JSONB,
  "error_message" VARCHAR(1000),
  "upload_expires_at" TIMESTAMP(3) NOT NULL,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "delete_after" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_analyses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_inference_integrations_game_id_key" ON "game_inference_integrations"("game_id");
CREATE UNIQUE INDEX "inventory_analyses_storage_key_key" ON "inventory_analyses"("storage_key");
CREATE INDEX "inventory_analyses_listing_id_created_at_idx" ON "inventory_analyses"("listing_id", "created_at");
CREATE INDEX "inventory_analyses_seller_id_created_at_idx" ON "inventory_analyses"("seller_id", "created_at");
CREATE INDEX "inventory_analyses_status_created_at_idx" ON "inventory_analyses"("status", "created_at");
CREATE INDEX "inventory_analyses_deleted_at_delete_after_idx" ON "inventory_analyses"("deleted_at", "delete_after");

ALTER TABLE "game_inference_integrations"
  ADD CONSTRAINT "game_inference_integrations_game_id_fkey"
  FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_analyses"
  ADD CONSTRAINT "inventory_analyses_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_analyses"
  ADD CONSTRAINT "inventory_analyses_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_analyses"
  ADD CONSTRAINT "inventory_analyses_game_id_fkey"
  FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
