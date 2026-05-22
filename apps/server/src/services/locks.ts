import { Verrou } from "@verrou/core";
import { memoryStore } from "@verrou/core/drivers/memory";
import { redisStore } from "@verrou/core/drivers/redis";
import { config } from "../config.ts";
import { redis } from "./redis.ts";

/**
 * Distributed lock manager backed by Verrou.
 *
 * Key-prefix coverage:
 * - The `redis` store passes the shared ioredis client to Verrou's Redis
 *   driver.  Verrou issues plain `SET`/`DEL` commands through that client, so
 *   the `keyPrefix` option on the shared client (set from `REDIS_KEY_PREFIX`)
 *   is applied automatically to every lock key.
 * - No additional prefix configuration is needed here — the shared client
 *   already handles environment isolation for Verrou.
 */
export const verrou = new Verrou({
	default: config.LOCK_STORE,
	stores: {
		memory: { driver: memoryStore() },
		redis: { driver: redisStore({ connection: redis }) },
	},
});
