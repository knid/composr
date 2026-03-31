ALTER TABLE "assembly_logs" ADD COLUMN "assembly_id" text;--> statement-breakpoint
CREATE INDEX "idx_assembly_logs_composition_id" ON "assembly_logs" USING btree ("composition_id");--> statement-breakpoint
CREATE INDEX "idx_block_versions_block_id" ON "block_versions" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "idx_comp_versions_composition_id" ON "composition_versions" USING btree ("composition_id");--> statement-breakpoint
CREATE INDEX "idx_deployments_composition_env" ON "deployments" USING btree ("composition_id","environment");--> statement-breakpoint
CREATE INDEX "idx_scores_composition_id" ON "scores" USING btree ("composition_id");