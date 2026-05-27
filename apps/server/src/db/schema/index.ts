/**
 * Schema barrel — single source of truth for all Drizzle table definitions.
 *
 * Both the runtime DB client (`src/db/index.ts`) and Drizzle Kit
 * (`drizzle.config.ts`) import from this file.  Add new domain schema
 * modules here as they are introduced in later spec tasks.
 *
 * Import order: auth tables first (they are referenced by domain FKs),
 * then domain tables in dependency order.
 */

// ── Auth tables (Better Auth managed) ──────────────────────────────────────
export * from "./auth.ts";

// ── Domain: Connected Account (Task 2) ─────────────────────────────────────
export * from "./connected_account.ts";

// ── Domain: Contact & Email Identity (Task 2) ──────────────────────────────
export * from "./contact.ts";

// ── Domain: Destination Integration (Task 2) ───────────────────────────────
export * from "./destination_integration.ts";

// ── Domain: Sync State & Sync Job (Task 2) ─────────────────────────────────
export * from "./sync.ts";
