import {
	GMAIL_POLL_QUEUE,
	GMAIL_WATCH_RENEWAL_QUEUE,
	type GmailPollPayload,
	registerGmailPollWorker,
	registerGmailWatchRenewalWorker,
} from "./gmail_poll.ts";
import { registerGmailHistorySyncWorker } from "./gmail_history_sync.ts";
import { registerGmailWatchSetupWorker } from "./gmail_watch.ts";

/**
 * Gmail ingestion boot wiring: register every ingestion worker and install
 * the repeating sweeps (BullMQ repeatables, env-prefixed via
 * `services/jobify.ts`).
 *
 * Schedule (all intervals from `config.ts` unless noted):
 *
 *   - `gmail-watch-renewal` — every `GMAIL_WATCH_RENEWAL_HOURS` (daily by
 *     default): re-watch accounts whose watch expires within 48h.
 *   - `gmail-poll` mode `poll` — every `GMAIL_POLL_INTERVAL_SECONDS` (tight):
 *     history-sync every `polling`/`degraded` account.
 *   - `gmail-poll` mode `repair` — every 30 min (slow safety net): history-
 *     sync `watching` accounts to repair missed pushes.
 *
 * EVERYTHING is gated on `GMAIL_INGESTION_ENABLED`: when the flag is off,
 * no worker is registered, no repeatable is added, and no Redis queue is
 * even created — the server boots exactly as before the pipeline existed.
 *
 * Repeatables are keyed by stable `repeatKey`s so redeploys upsert the
 * existing schedules (BullMQ job schedulers dedupe on the repeat key)
 * instead of stacking duplicates; the two `gmail-poll` modes get distinct
 * keys because they share one queue.
 *
 * Testability: no db/config/redis work at import time — config, worker
 * registration, and the schedule installer are injectable.
 */

/** Slow safety-net sweep interval for `watching` accounts (30 min). */
export const GMAIL_REPAIR_SWEEP_INTERVAL_MS = 30 * 60_000;

/** Stable BullMQ repeat keys (one per repeating sweep). */
export const GMAIL_WATCH_RENEWAL_REPEAT_KEY = "gmail-watch-renewal:sweep";
export const GMAIL_POLL_REPEAT_KEY = "gmail-poll:poll";
export const GMAIL_REPAIR_REPEAT_KEY = "gmail-poll:repair";

/** The config slice the scheduler consumes. */
export interface GmailSchedulerConfig {
	ingestionEnabled: boolean;
	pollIntervalSeconds: number;
	watchRenewalHours: number;
}

const getDefaultConfig = async (): Promise<GmailSchedulerConfig> => {
	const { config } = await import("../config.ts");
	return {
		ingestionEnabled: config.GMAIL_INGESTION_ENABLED,
		pollIntervalSeconds: config.GMAIL_POLL_INTERVAL_SECONDS,
		watchRenewalHours: config.GMAIL_WATCH_RENEWAL_HOURS,
	};
};

/** One repeatable to install. */
export interface GmailScheduleRequest {
	queue: string;
	repeatKey: string;
	everyMs: number;
	payload?: GmailPollPayload;
}

export interface GmailSchedulerDeps {
	/** Injectable config slice (defaults to `config.ts`, resolved lazily). */
	config?: GmailSchedulerConfig;
	/** Injectable worker registration (defaults to all ingestion workers). */
	registerWorkers?: () => Promise<void>;
	/** Injectable repeatable installer (defaults to BullMQ via jobify). */
	schedule?: (request: GmailScheduleRequest) => Promise<void>;
}

export type GmailSchedulerResult =
	| { started: false; reason: "ingestion_disabled" }
	| { started: true; schedules: GmailScheduleRequest[] };

/**
 * Pure schedule derivation — what gets installed for a given config.
 * Degraded/polling accounts ride the tight poll interval; watching accounts
 * only get the slow repair sweep.
 */
export const buildGmailSchedule = (
	config: Pick<
		GmailSchedulerConfig,
		"pollIntervalSeconds" | "watchRenewalHours"
	>,
): GmailScheduleRequest[] => [
	{
		queue: GMAIL_WATCH_RENEWAL_QUEUE,
		repeatKey: GMAIL_WATCH_RENEWAL_REPEAT_KEY,
		everyMs: config.watchRenewalHours * 3_600_000,
	},
	{
		queue: GMAIL_POLL_QUEUE,
		repeatKey: GMAIL_POLL_REPEAT_KEY,
		everyMs: config.pollIntervalSeconds * 1_000,
		payload: { mode: "poll" },
	},
	{
		queue: GMAIL_POLL_QUEUE,
		repeatKey: GMAIL_REPAIR_REPEAT_KEY,
		everyMs: GMAIL_REPAIR_SWEEP_INTERVAL_MS,
		payload: { mode: "repair" },
	},
];

const defaultRegisterWorkers = async (): Promise<void> => {
	await Promise.all([
		registerGmailWatchSetupWorker(),
		registerGmailHistorySyncWorker(),
		registerGmailPollWorker(),
		registerGmailWatchRenewalWorker(),
	]);
};

const getDefaultSchedule = async (): Promise<
	(request: GmailScheduleRequest) => Promise<void>
> => {
	const [pollJob, renewalJob] = await Promise.all([
		registerGmailPollWorker(),
		registerGmailWatchRenewalWorker(),
	]);
	return async (request) => {
		const repeat = { key: request.repeatKey, every: request.everyMs };
		if (request.queue === GMAIL_POLL_QUEUE) {
			if (!request.payload) {
				throw new Error("gmail-poll repeatables require a mode payload");
			}
			await pollJob.repeatable(repeat, request.payload);
			return;
		}
		if (request.queue === GMAIL_WATCH_RENEWAL_QUEUE) {
			await renewalJob.repeatable(repeat);
			return;
		}
		throw new Error(`Unknown gmail scheduler queue: ${request.queue}`);
	};
};

/**
 * Boot entry point (called once from `index.ts`). Registers workers first
 * so a repeatable firing immediately has a processor, then installs the
 * repeating sweeps. No-ops entirely when `GMAIL_INGESTION_ENABLED` is off.
 */
export const startGmailIngestionScheduler = async (
	deps: GmailSchedulerDeps = {},
): Promise<GmailSchedulerResult> => {
	const config = deps.config ?? (await getDefaultConfig());
	if (!config.ingestionEnabled) {
		return { started: false, reason: "ingestion_disabled" };
	}

	await (deps.registerWorkers ?? defaultRegisterWorkers)();

	const schedule = deps.schedule ?? (await getDefaultSchedule());
	const schedules = buildGmailSchedule(config);
	for (const request of schedules) {
		await schedule(request);
	}

	return { started: true, schedules };
};
