/**
 * Schema barrel — single source of truth for all Drizzle table definitions.
 *
 * Both the runtime DB client (`src/db/index.ts`) and Drizzle Kit
 * (`drizzle.config.ts`) import from this file.  Add new domain schema
 * modules here as they are introduced in later spec tasks.
 *
 * Import order: auth tables first (they are referenced by domain FKs).
 */
export * from "./auth.ts";
