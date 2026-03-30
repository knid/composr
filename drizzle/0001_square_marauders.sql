CREATE TABLE "eval_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"composition_id" uuid NOT NULL,
	"scorer_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sample_rate" integer DEFAULT 20 NOT NULL,
	"judge_model" text DEFAULT 'anthropic/claude-sonnet-4.6' NOT NULL,
	"judge_prompt" text,
	"weight" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"assembly_id" text NOT NULL,
	"composition_id" uuid NOT NULL,
	"composition_version" integer NOT NULL,
	"environment" "environment" NOT NULL,
	"variant_id" text,
	"context" jsonb,
	"input" text,
	"output" text,
	"model" text,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"auto_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"manual_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"overall_score" integer,
	"eval_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eval_configs" ADD CONSTRAINT "eval_configs_composition_id_compositions_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."compositions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;