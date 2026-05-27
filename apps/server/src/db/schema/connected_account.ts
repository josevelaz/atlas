/**
 * Atlas domain: Connected Account
 *
 * A `connected_account` represents a third-party email mailbox that a user
 * has authorized Atlas to access.  It is DISTINCT from the Better Auth
 * `account` table — Better Auth `account` records are OAuth credentials
 * managed by the auth layer, while `connected_account` is the Atlas domain
 * object that owns threads, messages, sync state, and email identities.
 *
 * Lifecycle:
 *   active      — mailbox is connected and sync is running
 *   disconnected — user disconnected; history is retained (soft disconnect)
 *   reactivating — reconnect flow in progress (token refresh / re-auth)
 *   error       — last sync attempt failed; requires user action
 *
 * Reconnect / reactivation semantics:
 *   A disconnected account can be reactivated by the user.  The existing
 *   `connected_account` row is updated (status → reactivating → active) so
 *   all historical threads, messages, and identities remain associated with
 *   the same row.  A new row is NOT created on reconnect.
 *
 * Token encryption:
 *   Provider access/refresh tokens are stored encrypted at rest.
 *   `enc_access_token` and `enc_refresh_token` hold the ciphertext.
 *   `enc_key_id` identifies which encryption key was used (for rotation).
 *   `enc_algorithm` records the algorithm (e.g. "AES-256-GCM").
 *   `enc_iv` holds the base64-encoded initialisation vector.
 *   The plaintext tokens MUST NOT be stored in this table.
 */
import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth.ts";

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const connectedAccount = sqliteTable(
	"connected_account",
	{
		id: text("id").primaryKey(),

		// Ownership — rooted in the Better Auth `user` table.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),

		// Provider identity — the email address of this mailbox.
		// Unique per user so the same mailbox cannot be connected twice.
		providerAccountEmail: text("provider_account_email").notNull(),

		// Provider type: "google" | "microsoft" | ...
		provider: text("provider").notNull(),

		// Lifecycle state.
		// CHECK constraint keeps the column to the agreed value set.
		status: text("status", {
			enum: ["active", "disconnected", "reactivating", "error"],
		})
			.notNull()
			.default("active"),

		// Display name shown in the Atlas UI (e.g. "Work Gmail").
		displayName: text("display_name"),

		// -----------------------------------------------------------------------
		// Encrypted token storage (sub-task 2.3)
		// -----------------------------------------------------------------------
		// Ciphertext of the provider access token.
		encAccessToken: text("enc_access_token"),
		// Ciphertext of the provider refresh token.
		encRefreshToken: text("enc_refresh_token"),
		// Expiry of the access token (UTC ms) — stored in plaintext for scheduling.
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		// Encryption key identifier — used for key rotation lookups.
		encKeyId: text("enc_key_id"),
		// Encryption algorithm, e.g. "AES-256-GCM".
		encAlgorithm: text("enc_algorithm"),
		// Base64-encoded initialisation vector.
		encIv: text("enc_iv"),

		// -----------------------------------------------------------------------
		// Timestamps
		// -----------------------------------------------------------------------
		connectedAt: integer("connected_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		disconnectedAt: integer("disconnected_at", { mode: "timestamp_ms" }),
		reactivatedAt: integer("reactivated_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// A user cannot connect the same mailbox address twice.
		uniqueIndex("connected_account_user_email_unique").on(
			table.userId,
			table.providerAccountEmail,
		),
		// Fast lookup of all accounts for a user.
		index("connected_account_user_id_idx").on(table.userId),
		// Enforce the lifecycle state value set at the DB level.
		check(
			"connected_account_status_check",
			sql`${table.status} IN ('active', 'disconnected', 'reactivating', 'error')`,
		),
	],
);

// ---------------------------------------------------------------------------
// Relations (forward-declared; back-references added in domain files)
// ---------------------------------------------------------------------------

export const connectedAccountRelations = relations(
	connectedAccount,
	({ one }) => ({
		user: one(user, {
			fields: [connectedAccount.userId],
			references: [user.id],
		}),
	}),
);
