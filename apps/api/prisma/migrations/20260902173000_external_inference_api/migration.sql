ALTER TABLE "game_inference_integrations"
  RENAME COLUMN "endpoint_id" TO "base_url";

ALTER TABLE "game_inference_integrations"
  ALTER COLUMN "base_url" TYPE VARCHAR(500),
  ALTER COLUMN "provider" SET DEFAULT 'EXTERNAL_API';

UPDATE "game_inference_integrations"
SET "provider" = 'EXTERNAL_API',
    "enabled" = false;

