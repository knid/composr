CREATE TABLE "provider_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_prefix" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "compositions" ADD COLUMN "folder" text;--> statement-breakpoint
ALTER TABLE "compositions" ADD COLUMN "output_schema" jsonb;--> statement-breakpoint
ALTER TABLE "compositions" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_keys" ADD CONSTRAINT "provider_keys_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;