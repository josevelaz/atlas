import { Redis } from "ioredis";
import { config } from "../config.ts";

export const redis = new Redis({
	host: config.REDIS_HOST,
	port: config.REDIS_PORT,
	keyPrefix: config.REDIS_KEY_PREFIX || undefined,
	tls: config.REDIS_TLS ? {} : undefined,
	// for bullmq
	maxRetriesPerRequest: null,
});
