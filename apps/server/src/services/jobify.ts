/**
 * @file jobify.ts — Queue factory with environment-aware BullMQ prefix injection.
 *
 * ## API surface audit (jobify v0.1.6 + bullmq v5.77.x)
 *
 * ### What jobify provides (use these exclusively for job definition)
 *
 * | Operation                        | API                                                    |
 * |----------------------------------|--------------------------------------------------------|
 * | Define a typed job               | `defineJob(name, opts?)`                               |
 * | Set input type                   | `.input<T>()`                                          |
 * | Set worker options (concurrency) | `.options({ concurrency: N, ... })`                    |
 * | Register processor               | `.action(async (job) => { ... })`                      |
 * | Enqueue one job                  | `.add(name, data, opts?)`                              |
 * | Enqueue many jobs                | `.addBulk([{ name, data, opts? }])`                    |
 * | Schedule repeatable job          | `.repeatable(repeatOpts, data?, opts?)`                |
 * | Access underlying Queue          | `job.queue` (BullMQ `Queue` instance)                  |
 * | Access underlying Worker         | `job.worker` (BullMQ `Worker` instance)                |
 *
 * ### What requires direct BullMQ (via `job.queue.*` or `bullmq` import)
 *
 * jobify intentionally exposes `job.queue` so callers can reach BullMQ APIs
 * that jobify does not wrap. The following operations MUST go through
 * `job.queue` directly — importing from `bullmq` is intentional and explicit:
 *
 * | Operation                        | BullMQ API                                             |
 * |----------------------------------|--------------------------------------------------------|
 * | Scheduler upsert (idempotent)    | `queue.upsertJobScheduler(id, repeatOpts, template?)`  |
 * | Remove a scheduler               | `queue.removeJobScheduler(id)`                         |
 * | Look up active jobs              | `queue.getActive(start?, end?)`                        |
 * | Look up jobs by state            | `queue.getJobs(types?, start?, end?)`                  |
 * | Check dedupe key                 | `queue.getDeduplicationJobId(id)`                      |
 * | Remove dedupe key                | `queue.removeDeduplicationKey(id)`                     |
 * | Get scheduler by id              | `queue.getJobScheduler(id)`                            |
 * | DLQ / retry failed jobs          | `queue.retryJobs({ state: 'failed' })`                 |
 * | Job counts by state              | `queue.getJobCounts(...types)`                         |
 *
 * ### JobsOptions features available via `.add(name, data, opts)`
 *
 * | Feature                          | Option field                                           |
 * |----------------------------------|--------------------------------------------------------|
 * | Retry attempts                   | `attempts: N`                                          |
 * | Backoff strategy + jitter        | `backoff: { type: 'exponential', delay: ms, jitter: % }`|
 * | Deduplication (dedupe)           | `deduplication: { id: string, ttl?: ms, keepLastIfActive?: bool }` |
 * | Delay before processing          | `delay: ms`                                            |
 * | Remove on complete               | `removeOnComplete: bool | N | { age, count }`          |
 * | Remove on fail (DLQ retention)   | `removeOnFail: bool | N | { age, count }`              |
 *
 * ### Redis / prefix discipline
 *
 * BullMQ manages its own key namespace (`bull:{queueName}:...`) and does NOT
 * inherit the ioredis `keyPrefix` option set on the shared Redis client.
 * We must pass `prefix` explicitly to every Queue and Worker so that staging
 * and preview environments sharing the same nonprod Redis instance cannot
 * collide with each other's job keys.
 *
 * When `REDIS_KEY_PREFIX` is set (e.g. `"staging:"` or `"preview-42:"`) the
 * effective BullMQ prefix becomes `{REDIS_KEY_PREFIX}bull`, e.g.
 * `staging:bull:{queueName}:...`.  When unset the prefix is the BullMQ
 * default `"bull"`.
 *
 * Any code that constructs a BullMQ `Queue` or `Worker` directly (e.g. for
 * scheduler upsert or active-job lookup) MUST use the exported `BULLMQ_PREFIX`
 * constant — never hardcode `"bull"`.
 */

import { initJobify } from "jobify";
import { config } from "../config.ts";
import { redis } from "./redis.ts";

/**
 * Environment-aware BullMQ prefix.
 *
 * Export this constant so any code that constructs a raw BullMQ `Queue` or
 * `Worker` (e.g. for `upsertJobScheduler`, `getActive`, or DLQ operations)
 * can apply the same prefix without duplicating the derivation logic.
 */
export const BULLMQ_PREFIX = config.REDIS_KEY_PREFIX
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
 *
 * For operations not covered by jobify (scheduler upsert, active job lookup,
 * dedupe key checks, DLQ retries), access `job.queue` directly and import
 * types from `bullmq`. Always use `BULLMQ_PREFIX` for any raw Queue/Worker
 * construction — see the module-level JSDoc for the full API surface map.
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
