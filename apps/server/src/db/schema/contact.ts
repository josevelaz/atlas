/**
 * Atlas domain: Contact and Email Identity
 *
 * `contact` — a person known to the user, scoped to the user.
 *   A contact aggregates one or more email addresses (email_identity rows)
 *   that the user has interacted with.
 *
 * `email_identity` — a single exact email address, unique per user.
 *   This is the atomic unit used for sender screening and routing rules.
 *   Exact-email uniqueness per user is enforced by a unique index on
 *   (user_id, email_address).
 *
 * Relationship:
 *   user → contact (1:many)
 *   contact → email_identity (1:many)
 *   user → email_identity (1:many, via contact)
 *
 * The exact email address on `email_identity` is the key used by the
 * Screener and sender routing rules.  Merging contacts does not change
 * the email_identity rows — it only re-parents them to a different contact.
 */
import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth.ts";

// ---------------------------------------------------------------------------
// contact
// ---------------------------------------------------------------------------

export const contact = sqliteTable(
	"contact",
	{
		id: text("id").primaryKey(),

		// Ownership — rooted in the Better Auth `user` table.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),

		// Display name for the contact (may be null until resolved).
		displayName: text("display_name"),

		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// Fast lookup of all contacts for a user.
		index("contact_user_id_idx").on(table.userId),
	],
);

// ---------------------------------------------------------------------------
// email_identity
// ---------------------------------------------------------------------------

export const emailIdentity = sqliteTable(
	"email_identity",
	{
		id: text("id").primaryKey(),

		// Ownership — rooted in the Better Auth `user` table.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),

		// Parent contact (optional — an identity may exist before a contact is
		// created or merged).
		contactId: text("contact_id").references(() => contact.id, {
			onDelete: "set null",
		}),

		// The exact email address.  Unique per user — the same address cannot
		// appear twice under the same user account.
		emailAddress: text("email_address").notNull(),

		// Display name associated with this address (from message headers).
		displayName: text("display_name"),

		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// Exact-email uniqueness per user — the core invariant for routing.
		uniqueIndex("email_identity_user_email_unique").on(
			table.userId,
			table.emailAddress,
		),
		// Fast lookup of all identities for a user.
		index("email_identity_user_id_idx").on(table.userId),
		// Fast lookup of all identities for a contact.
		index("email_identity_contact_id_idx").on(table.contactId),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const contactRelations = relations(contact, ({ one, many }) => ({
	user: one(user, {
		fields: [contact.userId],
		references: [user.id],
	}),
	emailIdentities: many(emailIdentity),
}));

export const emailIdentityRelations = relations(emailIdentity, ({ one }) => ({
	user: one(user, {
		fields: [emailIdentity.userId],
		references: [user.id],
	}),
	contact: one(contact, {
		fields: [emailIdentity.contactId],
		references: [contact.id],
	}),
}));
