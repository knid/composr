import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core"

// Shared enum for environment
export const environmentEnum = pgEnum("environment", ["dev", "staging", "prod"])

// teams — id IS the Clerk orgId (text, not uuid)
export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// api_keys
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  environment: environmentEnum("environment").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// blocks
export const blocks = pgTable("blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull().default(""),
  version: integer("version").notNull().default(1),
  tags: jsonb("tags").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// block_versions
export const blockVersions = pgTable("block_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  blockId: uuid("block_id")
    .notNull()
    .references(() => blocks.id),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
})

// compositions
export const compositions = pgTable("compositions", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  name: text("name").notNull(),
  description: text("description"),
  graph: jsonb("graph")
    .notNull()
    .default({ nodes: [], edges: [] }),
  contextSchema: jsonb("context_schema").notNull().default([]),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// composition_versions
export const compositionVersions = pgTable("composition_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  compositionId: uuid("composition_id")
    .notNull()
    .references(() => compositions.id),
  version: integer("version").notNull(),
  graph: jsonb("graph").notNull(),
  contextSchema: jsonb("context_schema").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
})

// deployments
export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  compositionId: uuid("composition_id")
    .notNull()
    .references(() => compositions.id),
  environment: environmentEnum("environment").notNull(),
  version: integer("version").notNull(),
  deployedAt: timestamp("deployed_at").notNull().defaultNow(),
  deployedBy: text("deployed_by").notNull(),
})

// assembly_logs
export const assemblyLogs = pgTable("assembly_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  compositionId: uuid("composition_id").notNull(),
  compositionVersion: integer("composition_version").notNull(),
  environment: environmentEnum("environment").notNull(),
  context: jsonb("context").notNull(),
  resolvedBlocks: jsonb("resolved_blocks").notNull(),
  variantId: text("variant_id"),
  tokenCount: integer("token_count"),
  assembledAt: timestamp("assembled_at").notNull().defaultNow(),
})

// scores
export const scores = pgTable("scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  assemblyId: text("assembly_id").notNull(),
  compositionId: uuid("composition_id").notNull(),
  compositionVersion: integer("composition_version").notNull(),
  environment: environmentEnum("environment").notNull(),
  variantId: text("variant_id"),
  context: jsonb("context"),
  input: text("input"),
  output: text("output"),
  model: text("model"),
  latencyMs: integer("latency_ms"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  autoScores: jsonb("auto_scores").notNull().default({}),
  manualScores: jsonb("manual_scores").notNull().default({}),
  overallScore: integer("overall_score"),
  evalStatus: text("eval_status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// audit_logs
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: text("team_id").notNull().references(() => teams.id),
  userId: text("user_id"), // Clerk userId
  action: text("action").notNull(), // "block.created", "composition.updated", "deployment.promoted", etc.
  resourceType: text("resource_type").notNull(), // "block", "composition", "deployment", "api_key"
  resourceId: text("resource_id"), // ID of the affected resource
  metadata: jsonb("metadata").notNull().default({}), // additional context (old/new values, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// eval_configs
export const evalConfigs = pgTable("eval_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  compositionId: uuid("composition_id")
    .notNull()
    .references(() => compositions.id),
  scorerName: text("scorer_name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sampleRate: integer("sample_rate").notNull().default(20),
  judgeModel: text("judge_model").notNull().default("anthropic/claude-sonnet-4.6"),
  judgePrompt: text("judge_prompt"),
  weight: integer("weight").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// usage_records
export const usageRecords = pgTable("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: text("team_id").notNull().references(() => teams.id),
  endpoint: text("endpoint").notNull(), // "config", "track", "score"
  count: integer("count").notNull().default(0),
  date: text("date").notNull(), // "2026-03-30" — daily bucket
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})
