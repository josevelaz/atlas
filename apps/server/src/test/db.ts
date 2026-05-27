/**
 * @file db.ts — Shared test helper: temp file-based SQLite factory.
 *
 * Creates an isolated, migrated Drizzle database backed by a temp file on disk.
 * File-based SQLite is required (not `:memory:`) because @libsql/client opens a
 * new connection per transaction, which would see an empty in-memory database.
 *
 * Usage:
 *   import { createTestDb } from "../../test/db.ts";
 *
 *   const { db, cleanup } = await createTestDb("my-test");
 *   // ... run tests ...
 *   await cleanup(); // removes the temp file
 *
 * Or use the beforeAll/afterAll helpers:
 *   import { withTestDb } from "../../test/db.ts";
 *
 *   const ctx = withTestDb("my-test");
 *   // ctx.db is available inside tests after beforeAll runs
 */

import { unlinkSync } from "node:fs";
import { afterAll, beforeAll } from "bun:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../db/schema/index.ts";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export interface TestDbContext {
	db: TestDb;
	cleanup: () => void;
}

/**
 * Create a temp file-based SQLite database, run all migrations, and return
 * the Drizzle instance along with a cleanup function.
 *
 * @param label - Short label used in the temp file name (for debugging).
 */
export async function createTestDb(label: string): Promise<TestDbContext> {
	const dbPath = `/tmp/${label}-${Date.now()}.db`;
	const client = createClient({ url: `file:${dbPath}` });
	const db = drizzle({ client, schema, casing: "snake_case" });

	// Resolve migrations folder relative to this file's location.
	const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;
	await migrate(db, { migrationsFolder });

	const cleanup = () => {
		try {
			unlinkSync(dbPath);
		} catch {
			// Ignore — file may already be gone.
		}
	};

	return { db, cleanup };
}

/**
 * Convenience wrapper that registers beforeAll/afterAll hooks for a test file.
 * Returns a context object whose `.db` property is populated after beforeAll runs.
 *
 * @param label - Short label used in the temp file name (for debugging).
 *
 * @example
 * const ctx = withTestDb("sync-state");
 *
 * test("something", async () => {
 *   const { db } = ctx;
 *   // use db ...
 * });
 */
export function withTestDb(label: string): { db: TestDb } {
	const ctx: { db: TestDb } = { db: null as unknown as TestDb };

	let cleanup: (() => void) | undefined;

	beforeAll(async () => {
		const result = await createTestDb(label);
		ctx.db = result.db;
		cleanup = result.cleanup;
	});

	afterAll(() => {
		cleanup?.();
	});

	return ctx;
}
