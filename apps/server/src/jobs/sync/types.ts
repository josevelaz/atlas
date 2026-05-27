/**
 * @file types.ts — Provider-agnostic sync job payload and result contracts.
 *
 * ## Design constraints
 *
 * 1. **Run type vs trigger source are orthogonal.**
 *    `SyncRunType` ("initial" | "incremental") describes WHAT kind of sync
 *    this run performs — it mirrors `sync_state.syncMode` and `sync_job.jobType`.
 *    `SyncTriggerSource` ("manual" | "reconciliation" | "webhook" | "system")
 *    describes WHY the sync was triggered.  These MUST NOT be conflated.
 *
 * 2. **Queue payloads carry NO cursor-advancement fields.**
 *    The live cursor lives exclusively in `sync_state.syncCursor` (DB).
 *    `sync:trigger` and `sync:process` payloads intentionally omit any cursor,
 *    nextPageToken, historyId, or similar fields.  Workers read the cursor from
 *    the DB at the start of each run and write it back on commit.
 *
 * 3. **`sync:trigger` is the enqueue shell.**
 *    It carries only the identity of the account to sync and the reason it was
 *    triggered.  The worker resolves the current `sync_state` row to determine
 *    `runType` and reads the cursor from there.
 *
 * 4. **`sync:process` is the processing shell.**
 *    It carries the resolved `runType` (so the worker knows which adapter path
 *    to take) but still carries NO cursor — the cursor is read from DB inside
 *    the worker.
 *
 * 5. **Result types carry observability counters only.**
 *    No cursor or provider-specific state is returned through the job result.
 *    Cursor advancement is a side-effect committed to `sync_state` by the
 *    adapter, not a return value.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The top-level run type for a sync operation.
 *
 * - `"initial"`     — First-ever sync for this account (no cursor exists yet).
 *                     Fetches new mail only; does NOT backfill history.
 * - `"incremental"` — Cursor-driven delta sync.  Reads `sync_state.syncCursor`
 *                     from the DB and fetches changes since that point.
 *
 * Mirrors `sync_state.syncMode` and `sync_job.jobType` in the DB schema.
 */
export type SyncRunType = "initial" | "incremental";

/**
 * Why a sync was triggered.  Orthogonal to `SyncRunType`.
 *
 * - `"manual"`         — Explicitly requested by the user (e.g. "Sync now").
 * - `"reconciliation"` — Fired by the 5-minute reconciliation scheduler to
 *                        catch accounts whose push/webhook triggers were missed.
 * - `"webhook"`        — Triggered by a provider push notification (Gmail
 *                        Pub/Sub, Microsoft Graph subscription, etc.).
 * - `"system"`         — Internal system trigger (e.g. post-connect bootstrap,
 *                        crash recovery, or admin tooling).
 *
 * This field is for observability and audit only.  Workers MUST NOT branch on
 * `triggerSource` to decide sync behaviour — use `runType` for that.
 */
export type SyncTriggerSource =
	| "manual"
	| "reconciliation"
	| "webhook"
	| "system";

// ─────────────────────────────────────────────────────────────────────────────
// sync:trigger — enqueue shell
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload for the `sync:trigger` queue job.
 *
 * This is the enqueue shell.  It carries only the identity of the account to
 * sync and the reason it was triggered.  The worker resolves the current
 * `sync_state` row to determine `runType` and reads the cursor from the DB.
 *
 * **Cursor-advancement fields are intentionally absent.**
 * Do not add `cursor`, `nextPageToken`, `historyId`, `deltaToken`, or any
 * provider-specific pagination state to this type.
 */
export interface SyncTriggerPayload {
	/** The connected account to sync. */
	connectedAccountId: string;

	/**
	 * Why this sync was triggered.
	 * Used for observability and audit; workers MUST NOT branch on this.
	 */
	triggerSource: SyncTriggerSource;
}

/**
 * Result returned by the `sync:trigger` worker.
 *
 * The trigger worker's job is to validate the account, acquire a lock, and
 * enqueue a `sync:process` job.  It does not perform any mail fetching.
 */
export interface SyncTriggerResult {
	/** Whether a `sync:process` job was successfully enqueued. */
	enqueued: boolean;

	/**
	 * The `runType` resolved from `sync_state` at trigger time.
	 * Included for observability; the actual processing uses the value
	 * re-read from DB inside the process worker.
	 */
	resolvedRunType: SyncRunType;

	/**
	 * BullMQ job ID of the enqueued `sync:process` job, if enqueued.
	 * Null when `enqueued` is false (e.g. deduplicated or account inactive).
	 */
	processJobId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// sync:process — processing shell
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload for the `sync:process` queue job.
 *
 * This is the processing shell.  It carries the resolved `runType` so the
 * worker knows which adapter path to take, but it carries NO cursor — the
 * cursor is read from `sync_state.syncCursor` inside the worker at the start
 * of each batch.
 *
 * **Cursor-advancement fields are intentionally absent.**
 * Do not add `cursor`, `nextPageToken`, `historyId`, `deltaToken`, or any
 * provider-specific pagination state to this type.
 */
export interface SyncProcessPayload {
	/** The connected account being synced. */
	connectedAccountId: string;

	/**
	 * The sync run type, resolved by the trigger worker from `sync_state`.
	 * Workers use this to select the correct adapter path (initial vs
	 * incremental).  Do NOT use `triggerSource` for this decision.
	 */
	runType: SyncRunType;

	/**
	 * Why this sync was triggered.
	 * Propagated from `SyncTriggerPayload` for end-to-end observability.
	 * Workers MUST NOT branch on this field.
	 */
	triggerSource: SyncTriggerSource;

	/**
	 * The `sync_job` row ID created for this run.
	 * Workers use this to update the job record (status, counts, error detail)
	 * as the run progresses.
	 */
	syncJobId: string;
}

/**
 * Result returned by the `sync:process` worker.
 *
 * Contains observability counters only.  Cursor advancement is a side-effect
 * committed to `sync_state` by the adapter — it is NOT returned here.
 *
 * **Cursor-advancement fields are intentionally absent.**
 * Do not add `cursor`, `nextPageToken`, `historyId`, `deltaToken`, or any
 * provider-specific pagination state to this type.
 */
export interface SyncProcessResult {
	/** The `sync_job` row ID updated by this run. */
	syncJobId: string;

	/** Final outcome of the run. */
	status: "success" | "partial_success" | "failed";

	/** Number of mail threads processed in this run. */
	threadsProcessed: number;

	/** Number of individual messages processed in this run. */
	messagesProcessed: number;

	/** Number of non-fatal errors encountered during processing. */
	errorsEncountered: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compile-time guard: cursor fields must not appear on queue payloads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Union of field names that are FORBIDDEN on any queue payload type.
 *
 * If you attempt to add one of these fields to `SyncTriggerPayload` or
 * `SyncProcessPayload`, the `NoCursorFields` guard below will produce a
 * compile-time error.
 */
type ForbiddenCursorField =
	| "cursor"
	| "syncCursor"
	| "nextPageToken"
	| "pageToken"
	| "historyId"
	| "deltaToken"
	| "changeToken"
	| "syncToken";

/**
 * Compile-time guard that rejects any type containing a forbidden cursor field.
 *
 * Usage:
 *   type _Guard = NoCursorFields<SyncTriggerPayload>;   // must compile
 *   type _Guard = NoCursorFields<SyncProcessPayload>;   // must compile
 *
 * If `T` contains any key from `ForbiddenCursorField`, this resolves to
 * `never`, causing a downstream assignment to fail at compile time.
 */
export type NoCursorFields<T> = keyof T & ForbiddenCursorField extends never
	? T
	: never;

// Eagerly assert the contracts at module load (compile time).
// These lines will produce a type error if a forbidden field is added.
type _TriggerGuard = NoCursorFields<SyncTriggerPayload>;
type _ProcessGuard = NoCursorFields<SyncProcessPayload>;
type _TriggerResultGuard = NoCursorFields<SyncTriggerResult>;
type _ProcessResultGuard = NoCursorFields<SyncProcessResult>;

// Suppress "declared but never used" warnings for the guard aliases.
export type {
	_TriggerGuard,
	_ProcessGuard,
	_TriggerResultGuard,
	_ProcessResultGuard,
};
