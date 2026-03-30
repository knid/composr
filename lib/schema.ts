import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core"

// Shared enum for environment
export const environmentEnum = pgEnum("environment", ["dev", "staging", "prod"])

// teams
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkOrgId: text("clerk_org_id").unique().notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// api_keys
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
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
  teamId: uuid("team_id")
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
  teamId: uuid("team_id")
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
  teamId: uuid("team_id")
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
