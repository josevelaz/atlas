import { Redis } from "ioredis";
import { config } from "../config.ts";

/**
 * Shared Redis client — the single ioredis instance for the entire server.
 *
 * All Redis usage MUST go through this export. Direct `new Redis(...)` calls
 * elsewhere are prohibited so that `keyPrefix` (and TLS/port config) is
 * enforced uniformly.
 *
 * Audit (2026-05-22): only `services/locks.ts` and `services/jobify.ts`
 * import Redis functionality, and both do so via this shared export.
 */
export const redis = new Redis({
	host: config.REDIS_HOST,
	port: config.REDIS_PORT,
	// Empty string → undefined: ioredis treats "" as a literal prefix, which
	// would corrupt every key. Passing undefined disables prefixing instead.
	keyPrefix: config.REDIS_KEY_PREFIX || undefined,
	tls: config.REDIS_TLS ? {} : undefined,
	// Required by BullMQ — disables the default retry limit so queued jobs
	// are not dropped on transient connection errors.
	maxRetriesPerRequest: null,
});

/**
 * Gracefully disconnect the shared Redis client.
 *
 * Call this during process shutdown (after all BullMQ workers and queues have
 * been closed) to release the TCP connection cleanly.  Safe to call multiple
 * times — ioredis ignores disconnect calls on an already-closed connection.
 */
export async function disconnectRedis(): Promise<void> {
	await redis.quit();
}
