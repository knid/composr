-- Block roles: enables multi-message (system/user/assistant) output
ALTER TABLE "blocks" ADD COLUMN "role" TEXT DEFAULT NULL;

-- Composition enhancements: folders, output schema, metadata
ALTER TABLE "compositions" ADD COLUMN "folder" TEXT DEFAULT NULL;
ALTER TABLE "compositions" ADD COLUMN "output_schema" JSONB DEFAULT NULL;
ALTER TABLE "compositions" ADD COLUMN "metadata" JSONB DEFAULT '{}';
