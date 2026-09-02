UPDATE "game_inference_integrations"
SET "base_url" = NULL,
    "api_key_encrypted" = NULL,
    "api_key_last_four" = NULL,
    "enabled" = false
WHERE "provider" = 'EXTERNAL_API';

