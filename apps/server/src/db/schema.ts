import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.default(false)
		.notNull(),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp_ms",
		}),
		scope: text("scope"),
		password: text("password"),
		isPrimary: integer("is_primary", { mode: "boolean" })
			.default(false)
			.notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("account_userId_idx").on(table.userId),
		uniqueIndex("account_user_primary_uq")
			.on(table.userId)
			.where(sql`is_primary = 1`),
	],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

// --- Mail domain tables ---

export const connectedAccount = sqliteTable(
	"connected_account",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => Bun.randomUUIDv7()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		authAccountId: text("auth_account_id")
			.notNull()
			.references(() => account.id, { onDelete: "cascade" }),
		provider: text("provider", { enum: ["gmail"] })
			.default("gmail")
			.notNull(),
		emailAddress: text("email_address").notNull(),
		status: text("status", { enum: ["active", "disconnected"] })
			.default("active")
			.notNull(),
		syncState: text("sync_state", {
			enum: ["pending", "watching", "polling", "degraded"],
		})
			.default("pending")
			.notNull(),
		checkpointHistoryId: text("checkpoint_history_id"),
		checkpointAt: integer("checkpoint_at", { mode: "timestamp_ms" }),
		lastSyncedHistoryId: text("last_synced_history_id"),
		lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
		watchExpiration: integer("watch_expiration", { mode: "timestamp_ms" }),
		watchFailureCount: integer("watch_failure_count").default(0).notNull(),
		disconnectedAt: integer("disconnected_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("connected_account_user_email_provider_uq").on(
			table.userId,
			table.emailAddress,
			table.provider,
		),
		index("connected_account_userId_idx").on(table.userId),
	],
);

export const sender = sqliteTable(
	"sender",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => Bun.randomUUIDv7()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		emailAddress: text("email_address").notNull(),
		trust: text("trust", { enum: ["unscreened", "accepted", "rejected"] })
			.default("unscreened")
			.notNull(),
		defaultCategory: text("default_category", {
			enum: ["inbox", "feed", "paper_trail"],
		}),
		decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("sender_user_email_uq").on(table.userId, table.emailAddress),
		index("sender_user_trust_idx").on(table.userId, table.trust),
	],
);

export const thread = sqliteTable(
	"thread",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => Bun.randomUUIDv7()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		connectedAccountId: text("connected_account_id")
			.notNull()
			.references(() => connectedAccount.id, { onDelete: "cascade" }),
		providerThreadId: text("provider_thread_id").notNull(),
		state: text("state", {
			enum: ["screener", "spam", "categorized", "hidden"],
		})
			.default("screener")
			.notNull(),
		category: text("category", { enum: ["inbox", "feed", "paper_trail"] }),
		categoryOverridden: integer("category_overridden", { mode: "boolean" })
			.default(false)
			.notNull(),
		senderEmail: text("sender_email").notNull(),
		subject: text("subject"),
		preview: text("preview"),
		lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),
		messageCount: integer("message_count").default(0).notNull(),
		read: integer("read", { mode: "boolean" }).default(false).notNull(),
		archived: integer("archived", { mode: "boolean" }).default(false).notNull(),
		trashed: integer("trashed", { mode: "boolean" }).default(false).notNull(),
		firstIngestedAt: integer("first_ingested_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("thread_account_provider_thread_uq").on(
			table.connectedAccountId,
			table.providerThreadId,
		),
		index("thread_user_state_last_message_idx").on(
			table.userId,
			table.state,
			table.lastMessageAt,
		),
		index("thread_connectedAccountId_idx").on(table.connectedAccountId),
	],
);

export const message = sqliteTable(
	"message",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => Bun.randomUUIDv7()),
		threadId: text("thread_id")
			.notNull()
			.references(() => thread.id, { onDelete: "cascade" }),
		connectedAccountId: text("connected_account_id")
			.notNull()
			.references(() => connectedAccount.id, { onDelete: "cascade" }),
		providerMessageId: text("provider_message_id").notNull(),
		fromEmail: text("from_email").notNull(),
		fromName: text("from_name"),
		toJson: text("to_json", { mode: "json" }).$type<
			Array<{ email: string; name?: string }>
		>(),
		sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
		preview: text("preview"),
		bodyState: text("body_state", {
			enum: ["preview_only", "fetched", "unavailable"],
		})
			.default("preview_only")
			.notNull(),
		bodyRef: text("body_ref"),
		spamFlaggedAtIngest: integer("spam_flagged_at_ingest", {
			mode: "boolean",
		})
			.default(false)
			.notNull(),
		rfc822MessageId: text("rfc822_message_id"),
		inReplyTo: text("in_reply_to"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("message_account_provider_message_uq").on(
			table.connectedAccountId,
			table.providerMessageId,
		),
		index("message_thread_sent_at_idx").on(table.threadId, table.sentAt),
	],
);

export const attachment = sqliteTable(
	"attachment",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => Bun.randomUUIDv7()),
		messageId: text("message_id")
			.notNull()
			.references(() => message.id, { onDelete: "cascade" }),
		providerAttachmentId: text("provider_attachment_id").notNull(),
		filename: text("filename"),
		mimeType: text("mime_type"),
		sizeBytes: integer("size_bytes"),
		bytesState: text("bytes_state", {
			enum: ["metadata_only", "fetched", "unavailable"],
		})
			.default("metadata_only")
			.notNull(),
		storageRef: text("storage_ref"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [index("attachment_messageId_idx").on(table.messageId)],
);

export const syncGap = sqliteTable(
	"sync_gap",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => Bun.randomUUIDv7()),
		connectedAccountId: text("connected_account_id")
			.notNull()
			.references(() => connectedAccount.id, { onDelete: "cascade" }),
		fromHistoryId: text("from_history_id").notNull(),
		resetToHistoryId: text("reset_to_history_id").notNull(),
		reason: text("reason").notNull(),
		detectedAt: integer("detected_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index("sync_gap_connectedAccountId_idx").on(table.connectedAccountId),
	],
);

// --- Relations ---

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	connectedAccounts: many(connectedAccount),
	senders: many(sender),
	threads: many(thread),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one, many }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
	connectedAccounts: many(connectedAccount),
}));

export const connectedAccountRelations = relations(
	connectedAccount,
	({ one, many }) => ({
		user: one(user, {
			fields: [connectedAccount.userId],
			references: [user.id],
		}),
		authAccount: one(account, {
			fields: [connectedAccount.authAccountId],
			references: [account.id],
		}),
		threads: many(thread),
		messages: many(message),
		syncGaps: many(syncGap),
	}),
);

export const senderRelations = relations(sender, ({ one }) => ({
	user: one(user, {
		fields: [sender.userId],
		references: [user.id],
	}),
}));

export const threadRelations = relations(thread, ({ one, many }) => ({
	user: one(user, {
		fields: [thread.userId],
		references: [user.id],
	}),
	connectedAccount: one(connectedAccount, {
		fields: [thread.connectedAccountId],
		references: [connectedAccount.id],
	}),
	messages: many(message),
}));

export const messageRelations = relations(message, ({ one, many }) => ({
	thread: one(thread, {
		fields: [message.threadId],
		references: [thread.id],
	}),
	connectedAccount: one(connectedAccount, {
		fields: [message.connectedAccountId],
		references: [connectedAccount.id],
	}),
	attachments: many(attachment),
}));

export const attachmentRelations = relations(attachment, ({ one }) => ({
	message: one(message, {
		fields: [attachment.messageId],
		references: [message.id],
	}),
}));

export const syncGapRelations = relations(syncGap, ({ one }) => ({
	connectedAccount: one(connectedAccount, {
		fields: [syncGap.connectedAccountId],
		references: [connectedAccount.id],
	}),
}));
