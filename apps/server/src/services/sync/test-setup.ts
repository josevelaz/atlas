/**
 * @file test-setup.ts — Preload script for sync service tests.
 *
 * Sets required environment variables before any test modules are loaded.
 * config.ts reads BETTER_AUTH_SECRET at module evaluation time (required),
 * so this must run before config.ts is imported by any module in the graph.
 *
 * Loaded via `bunfig.toml` [test] preload in apps/server/.
 */

// BETTER_AUTH_SECRET is required by config.ts at module evaluation time.
// Set a dummy value so tests that don't exercise auth can load without error.
if (!process.env.BETTER_AUTH_SECRET) {
	process.env.BETTER_AUTH_SECRET = "test-secret-for-sync-service-tests";
}
