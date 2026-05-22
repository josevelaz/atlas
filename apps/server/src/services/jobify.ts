import { initJobify } from "jobify";
import { config } from "../config.ts";
import { redis } from "./redis.ts";

/**
 * BullMQ prefix for all queues and workers.
 *
 * BullMQ manages its own key namespace (e.g. `bull:{queueName}:...`) and does
 * NOT inherit the ioredis `keyPrefix` option set on the shared Redis client.
 * We must pass `prefix` explicitly to every Queue and Worker so that staging
 * and preview environments sharing the same nonprod Redis instance cannot
 * collide with each other's job keys.
 *
 * When `REDIS_KEY_PREFIX` is set (e.g. "staging:" or "preview-42:") the
 * effective BullMQ prefix becomes `{REDIS_KEY_PREFIX}bull`, e.g.
 * `staging:bull:{queueName}:...`.  When unset the prefix is the BullMQ
 * default `"bull"`.
 */
const BULLMQ_PREFIX = config.REDIS_KEY_PREFIX
	? `${config.REDIS_KEY_PREFIX}bull`
	: "bull";

const _defineJob = initJobify(redis);

/**
 * Thin wrapper around jobify's `initJobify` that injects the environment-aware
 * BullMQ prefix into every Queue and Worker created through this factory.
 *
 * Usage is identical to the raw `initJobify` return value — call `defineJob`
 * with a job name and optional options, then chain `.input()`, `.options()`,
 * and `.action()` as normal.
 */
export const defineJob: typeof _defineJob = (jobName, options) => {
	const job = _defineJob(jobName, {
		...options,
		queue:
			options?.queue && "add" in options.queue
				? // Caller passed a pre-built Queue instance — leave it untouched.
					options.queue
				: {
						prefix: BULLMQ_PREFIX,
						...options?.queue,
					},
	});

	// Patch the worker options so Workers also carry the prefix.  We wrap the
	// original `.options()` method to merge in the prefix before forwarding.
	const originalOptions = job.options.bind(job);
	job.options = (workerOptions) =>
		originalOptions({ prefix: BULLMQ_PREFIX, ...workerOptions });

	return job;
};
