CREATE TABLE "pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"graph" jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_clerk_org_id_unique";--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "team_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "assembly_logs" ALTER COLUMN "team_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "team_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "blocks" ALTER COLUMN "team_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "compositions" ALTER COLUMN "team_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "team_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "usage_records" ALTER COLUMN "team_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "eval_configs" ADD COLUMN "type" text DEFAULT 'llm_judge' NOT NULL;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "clerk_org_id";