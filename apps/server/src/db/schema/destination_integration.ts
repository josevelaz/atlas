/**
 * Atlas domain: Destination Integration
 *
 * A `destination_integration` is a third-party service (e.g. Google Tasks,
 * Outlook Calendar, Notion, Linear) that the user has connected to receive
 * confirmed action items from Atlas.
 *
 * This is DISTINCT from `connected_account` (which is a mailbox) — a
 * destination integration is a write-only outbound target, not a mail source.
 *
 * Lifecycle:
 *   active      — integration is connected and can receive action items
 *   disconnected — user disconnected; confirmed action items are retained
 *   error       — last write attempt failed; requires user action
 *
 * Dedupe invariant:
 *   A user cannot connect the same provider + external account combination
 *   twice.  The unique index on (user_id, provider, provider_account_id)
 *   enforces this at the database level.
 *
 * Token encryption:
 *   Same pattern as `connected_account` — plaintext tokens are never stored.
 *   `enc_access_token`, `enc_refresh_token`, `enc_key_id`, `enc_algorithm`,
 *   and `enc_iv` hold the encrypted material and rotation metadata.
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

export const destinationIntegration = sqliteTable(
	"destination_integration",
	{
		id: text("id").primaryKey(),

		// Ownership — rooted in the Better Auth `user` table.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),

		// Provider type: "google_tasks" | "outlook_calendar" | "notion" | ...
		provider: text("provider").notNull(),

		// The provider-side account/workspace identifier (opaque string).
		providerAccountId: text("provider_account_id").notNull(),

		// Human-readable label shown in the Atlas UI.
		displayName: text("display_name"),

		// Lifecycle state.
		status: text("status", {
			enum: ["active", "disconnected", "error"],
		})
			.notNull()
			.default("active"),

		// -----------------------------------------------------------------------
		// Encrypted token storage
		// -----------------------------------------------------------------------
		encAccessToken: text("enc_access_token"),
		encRefreshToken: text("enc_refresh_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		encKeyId: text("enc_key_id"),
		encAlgorithm: text("enc_algorithm"),
		encIv: text("enc_iv"),

		// -----------------------------------------------------------------------
		// Timestamps
		// -----------------------------------------------------------------------
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// Dedupe: same user cannot connect the same provider account twice.
		uniqueIndex("destination_integration_user_provider_account_unique").on(
			table.userId,
			table.provider,
			table.providerAccountId,
		),
		// Fast lookup of all integrations for a user.
		index("destination_integration_user_id_idx").on(table.userId),
		// Enforce the lifecycle state value set at the DB level.
		check(
			"destination_integration_status_check",
			sql`${table.status} IN ('active', 'disconnected', 'error')`,
		),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const destinationIntegrationRelations = relations(
	destinationIntegration,
	({ one }) => ({
		user: one(user, {
			fields: [destinationIntegration.userId],
			references: [user.id],
		}),
	}),
);
