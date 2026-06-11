/**
 * Identity DTOs — mirror the server's identity endpoints exactly.
 *
 * Server contract (apps/server/src/server.ts):
 *   GET /me                          → { user: UserProfile }            (401 when signed out)
 *   GET /me/connected-accounts      → { accounts, primaryConnectedAccountId }
 *   PUT /me/primary-connected-account { accountId } → 204
 *
 * This module is independent of `lib/atlas/**` by design.
 */

/** The signed-in user, as returned by `GET /me`. */
export interface UserProfile {
	id: string;
	name: string;
	email: string;
	/** Avatar URL, or null when the user has none. */
	image: string | null;
	/** ISO 8601 timestamp. */
	createdAt: string;
}

/**
 * A connected OAuth account (Google, etc.) as returned by
 * `GET /me/connected-accounts`. Credential (email/password) rows are
 * never included.
 */
export interface ConnectedAccount {
	id: string;
	providerId: string;
	/** Provider account email (from the id token), or the user's email. */
	email: string;
	/** Whether this is the effective primary connected account. */
	isPrimary: boolean;
	/** ISO 8601 timestamp. */
	createdAt: string;
}

/** Response body of `GET /me/connected-accounts`. */
export interface ConnectedAccountsResponse {
	accounts: ConnectedAccount[];
	/**
	 * Effective primary connected account id; empty string when the user
	 * has no connected OAuth accounts (credential-only users).
	 */
	primaryConnectedAccountId: string;
}

/**
 * A combined view of the user's identity state.
 *
 * `user === null` means signed out — a valid state, not an error.
 */
export interface IdentitySnapshot {
	user: UserProfile | null;
	accounts: ConnectedAccount[];
	/** Empty string when there are no connected OAuth accounts. */
	primaryConnectedAccountId: string;
}
