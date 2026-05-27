/**
 * @file provider.ts — Provider-agnostic sync adapter interfaces.
 *
 * ## Design constraints
 *
 * 1. **No provider SDK imports.**
 *    This file MUST NOT import from `googleapis`, `@microsoft/microsoft-graph-client`,
 *    `@azure/msal-node`, or any other provider-specific package.  Adapters are
 *    defined by interface only; concrete implementations live in separate files.
 *
 * 2. **Cursor lives in the DB, not in adapter return values.**
 *    `SyncAdapter.fetchInitialBatch` establishes the forward cursor by writing
 *    it to `sync_state.syncCursor` via `SyncAdapterContext.commitCursor`.
 *    `SyncAdapter.fetchIncrementalBatch` reads the cursor from the context
 *    (sourced from `sync_state.syncCursor`) and commits the next cursor the
 *    same way.  Cursors are NEVER returned as function return values.
 *
 * 3. **Adapters are stateless.**
 *    Each method call receives everything it needs through its arguments.
 *    Adapters MUST NOT cache cursors, tokens, or provider state between calls.
 *
 * 4. **Only fake/test adapters and unsupported-provider stubs are provided here.**
 *    Real Gmail and Outlook adapters are out of scope for this issue.
 *
 * ## Adapter lifecycle
 *
 *   Initial sync
 *   ────────────
 *   1. Worker calls `adapter.fetchInitialBatch(ctx)`.
 *   2. Adapter fetches new-mail-only (no history backfill).
 *   3. Adapter calls `ctx.commitCursor(cursor)` to persist the forward cursor.
 *   4. Adapter returns `SyncBatchResult` with the items fetched.
 *   5. Worker repeats until `hasMore` is false.
 *
 *   Incremental sync
 *   ────────────────
 *   1. Worker reads `sync_state.syncCursor` from DB and passes it via `ctx`.
 *   2. Worker calls `adapter.fetchIncrementalBatch(ctx)`.
 *   3. Adapter uses `ctx.cursor` to fetch changes since that point.
 *   4. Adapter calls `ctx.commitCursor(nextCursor)` to advance the cursor.
 *   5. Adapter returns `SyncBatchResult` with the items fetched.
 *   6. Worker repeats until `hasMore` is false.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared data types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A minimal, provider-agnostic representation of a mail message fetched
 * during a sync batch.
 *
 * Adapters map provider-specific message objects to this shape before
 * returning them.  Workers persist these items to the DB without knowing
 * which provider produced them.
 */
export interface SyncMailItem {
	/** Provider-assigned message ID (opaque string). */
	providerMessageId: string;

	/** Provider-assigned thread ID (opaque string). */
	providerThreadId: string;

	/**
	 * RFC 2822 raw message bytes, base64url-encoded.
	 * Null when the adapter fetches metadata-only in a first pass.
	 */
	rawMessageBase64: string | null;

	/** UTC timestamp of the message (ms since epoch). */
	receivedAt: number;

	/** Whether the message has been read by the user. */
	isRead: boolean;

	/** Whether the message is in the Trash. */
	isTrashed: boolean;

	/** Provider label/folder IDs applied to this message. */
	labelIds: string[];
}

/**
 * Result returned by a single adapter batch fetch.
 *
 * **Cursor-advancement fields are intentionally absent.**
 * The next cursor is committed to `sync_state.syncCursor` via
 * `SyncAdapterContext.commitCursor` as a side-effect inside the adapter.
 * It is NOT returned here.
 */
export interface SyncBatchResult {
	/** Mail items fetched in this batch. May be empty. */
	items: SyncMailItem[];

	/**
	 * Whether more batches remain.
	 * When `true`, the worker calls the adapter again.
	 * When `false`, the run is complete.
	 */
	hasMore: boolean;

	/** Number of non-fatal errors encountered while fetching this batch. */
	errorsEncountered: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Context passed to every adapter method call.
 *
 * Provides the adapter with everything it needs to perform a batch fetch:
 * the account identity, the current cursor (for incremental runs), and a
 * callback to commit the next cursor to the DB.
 */
export interface SyncAdapterContext {
	/** The connected account being synced. */
	connectedAccountId: string;

	/**
	 * The current sync cursor read from `sync_state.syncCursor`.
	 *
	 * - For initial sync: `null` (no cursor exists yet).
	 * - For incremental sync: the opaque cursor string committed by the
	 *   previous run.
	 *
	 * Adapters MUST NOT modify this value directly.  Use `commitCursor` to
	 * advance it.
	 */
	readonly cursor: string | null;

	/**
	 * Commit the next cursor to `sync_state.syncCursor` in the DB.
	 *
	 * Adapters MUST call this after each successful batch fetch so that the
	 * cursor is durably persisted before the worker processes the items.
	 * This ensures that a crash between batches does not lose progress.
	 *
	 * @param nextCursor - The opaque cursor string returned by the provider.
	 *   Pass `null` to clear the cursor (e.g. on a full reset).
	 */
	commitCursor(nextCursor: string | null): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provider-agnostic sync adapter interface.
 *
 * Each mail provider (Gmail, Outlook, …) implements this interface.
 * Workers call the adapter methods without knowing which provider is in use.
 *
 * ## Cursor discipline
 *
 * Adapters MUST commit the next cursor via `ctx.commitCursor(nextCursor)`
 * BEFORE returning `SyncBatchResult`.  This ensures durability: if the worker
 * crashes after the adapter returns but before it can persist the cursor
 * itself, the cursor is already in the DB.
 *
 * Adapters MUST NOT return cursor values in `SyncBatchResult`.
 */
export interface SyncAdapter {
	/**
	 * Fetch the first (and possibly only) batch of mail for an initial sync.
	 *
	 * Initial sync is new-mail-only — adapters MUST NOT backfill historical
	 * messages.  The adapter establishes the forward cursor by calling
	 * `ctx.commitCursor(cursor)` so that subsequent incremental syncs can
	 * pick up from this point.
	 *
	 * @param ctx - Adapter context.  `ctx.cursor` is always `null` for initial
	 *   sync; adapters MUST NOT rely on it being set.
	 */
	fetchInitialBatch(ctx: SyncAdapterContext): Promise<SyncBatchResult>;

	/**
	 * Fetch the next batch of changes for an incremental sync.
	 *
	 * The adapter reads `ctx.cursor` to determine where to resume, fetches
	 * changes since that point, and commits the next cursor via
	 * `ctx.commitCursor(nextCursor)` before returning.
	 *
	 * @param ctx - Adapter context.  `ctx.cursor` is always non-null for
	 *   incremental sync; adapters SHOULD throw if it is null.
	 */
	fetchIncrementalBatch(ctx: SyncAdapterContext): Promise<SyncBatchResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Known mail provider identifiers.
 *
 * Matches the `provider` column on `connected_account`.
 */
export type SyncProviderKey = "google" | "microsoft";

/**
 * Registry that maps provider keys to their adapter implementations.
 *
 * Workers look up the adapter for a connected account's provider at runtime.
 * Only providers present in the registry are supported; all others receive
 * the `UnsupportedProviderAdapter` stub.
 */
export type SyncAdapterRegistry = Partial<Record<SyncProviderKey, SyncAdapter>>;

// ─────────────────────────────────────────────────────────────────────────────
// Stub adapters (test / unsupported-provider)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stub adapter for providers that are not yet implemented.
 *
 * Both methods throw `UnsupportedProviderError` immediately.  Workers catch
 * this error and mark the `sync_job` as `failed` with an appropriate message.
 *
 * This stub is intentionally NOT registered in the default adapter registry —
 * it is returned by `resolveAdapter` when no registered adapter is found.
 */
export class UnsupportedProviderAdapter implements SyncAdapter {
	constructor(private readonly providerKey: string) {}

	async fetchInitialBatch(_ctx: SyncAdapterContext): Promise<SyncBatchResult> {
		throw new UnsupportedProviderError(this.providerKey);
	}

	async fetchIncrementalBatch(
		_ctx: SyncAdapterContext,
	): Promise<SyncBatchResult> {
		throw new UnsupportedProviderError(this.providerKey);
	}
}

/**
 * Error thrown by `UnsupportedProviderAdapter` when a sync is attempted for
 * a provider that has no registered adapter.
 */
export class UnsupportedProviderError extends Error {
	readonly providerKey: string;

	constructor(providerKey: string) {
		super(
			`No sync adapter registered for provider "${providerKey}". ` +
				`Add an adapter to the SyncAdapterRegistry to enable sync for this provider.`,
		);
		this.name = "UnsupportedProviderError";
		this.providerKey = providerKey;
	}
}

/**
 * Fake in-memory adapter for use in tests and local development.
 *
 * Returns a configurable set of `SyncMailItem` fixtures and commits a
 * deterministic cursor string.  Does NOT make any network calls.
 *
 * ## Usage
 *
 * ```ts
 * const adapter = new FakeSyncAdapter({
 *   initialItems: [{ providerMessageId: "msg-1", ... }],
 *   incrementalItems: [{ providerMessageId: "msg-2", ... }],
 *   initialCursor: "cursor-after-initial",
 *   incrementalCursor: "cursor-after-incremental",
 * });
 * ```
 */
export class FakeSyncAdapter implements SyncAdapter {
	private readonly opts: FakeSyncAdapterOptions;

	constructor(opts: Partial<FakeSyncAdapterOptions> = {}) {
		this.opts = {
			initialItems: opts.initialItems ?? [],
			incrementalItems: opts.incrementalItems ?? [],
			initialCursor: opts.initialCursor ?? "fake-initial-cursor",
			incrementalCursor: opts.incrementalCursor ?? "fake-incremental-cursor",
			errorsEncountered: opts.errorsEncountered ?? 0,
		};
	}

	async fetchInitialBatch(ctx: SyncAdapterContext): Promise<SyncBatchResult> {
		await ctx.commitCursor(this.opts.initialCursor);
		return {
			items: this.opts.initialItems,
			hasMore: false,
			errorsEncountered: this.opts.errorsEncountered,
		};
	}

	async fetchIncrementalBatch(
		ctx: SyncAdapterContext,
	): Promise<SyncBatchResult> {
		if (ctx.cursor === null) {
			throw new Error(
				"FakeSyncAdapter.fetchIncrementalBatch: ctx.cursor must not be null for incremental sync",
			);
		}
		await ctx.commitCursor(this.opts.incrementalCursor);
		return {
			items: this.opts.incrementalItems,
			hasMore: false,
			errorsEncountered: this.opts.errorsEncountered,
		};
	}
}

/**
 * Configuration options for `FakeSyncAdapter`.
 */
export interface FakeSyncAdapterOptions {
	/** Items returned by `fetchInitialBatch`. */
	initialItems: SyncMailItem[];

	/** Items returned by `fetchIncrementalBatch`. */
	incrementalItems: SyncMailItem[];

	/** Cursor committed after `fetchInitialBatch`. */
	initialCursor: string;

	/** Cursor committed after `fetchIncrementalBatch`. */
	incrementalCursor: string;

	/** Non-fatal error count to include in batch results. */
	errorsEncountered: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter resolution helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the adapter for a given provider key from the registry.
 *
 * Returns the registered adapter if found, or an `UnsupportedProviderAdapter`
 * stub if the provider is not in the registry.
 *
 * @param registry - The adapter registry to look up.
 * @param providerKey - The provider identifier from `connected_account.provider`.
 */
export function resolveAdapter(
	registry: SyncAdapterRegistry,
	providerKey: string,
): SyncAdapter {
	const known = providerKey as SyncProviderKey;
	return registry[known] ?? new UnsupportedProviderAdapter(providerKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// Compile-time guard: SyncBatchResult must not carry cursor fields
// ─────────────────────────────────────────────────────────────────────────────

type ForbiddenCursorField =
	| "cursor"
	| "syncCursor"
	| "nextPageToken"
	| "pageToken"
	| "historyId"
	| "deltaToken"
	| "changeToken"
	| "syncToken";

type NoCursorFields<T> = keyof T & ForbiddenCursorField extends never
	? T
	: never;

type _BatchResultGuard = NoCursorFields<SyncBatchResult>;
export type { _BatchResultGuard };
