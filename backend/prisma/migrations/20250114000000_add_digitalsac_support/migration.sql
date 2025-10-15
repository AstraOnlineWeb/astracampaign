-- Add DigitalSac configuration fields to GlobalSettings
ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "digitalsac_host" TEXT NOT NULL DEFAULT '';
ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "digitalsac_token" TEXT NOT NULL DEFAULT '';

-- Add connectionUuid field to WhatsAppSession for DigitalSac
ALTER TABLE "whatsapp_sessions" ADD COLUMN IF NOT EXISTS "connection_uuid" TEXT;

-- Update provider enum to include DIGITALSAC (if using PostgreSQL)
-- Note: For SQLite, the provider field already accepts any string value
-- For PostgreSQL, you may need to alter the enum type if it exists

-- Add comment for documentation
COMMENT ON COLUMN "whatsapp_sessions"."connection_uuid" IS 'UUID da conexão DigitalSac';
COMMENT ON COLUMN "global_settings"."digitalsac_host" IS 'URL base da API DigitalSac';
COMMENT ON COLUMN "global_settings"."digitalsac_token" IS 'Token de autenticação Bearer da API DigitalSac';

