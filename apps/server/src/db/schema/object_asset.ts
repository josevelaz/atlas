/**
 * Atlas domain: Object Asset, Raw Payload Reference, and Attachment
 *
 * ── object_asset ─────────────────────────────────────────────────────────────
 *
 *   A shared object-storage reference concept used by both attachment blobs
 *   and raw provider/message payload snapshots.  Binary content is stored in
 *   object storage (e.g. S3-compatible); this table holds the stable reference
 *   metadata needed to locate and retrieve it.
 *
 *   Using a shared `object_asset` table avoids duplicating storage-reference
 *   semantics across attachment and raw-payload use cases.
 *
 *   Fields:
 *     - `bucket`       — object-storage bucket name
 *     - `object_key`   — stable key within the bucket (never a signed URL)
 *     - `content_type` — MIME type of the stored object
 *     - `byte_size`    — size in bytes (for display and quota tracking)
 *     - `checksum`     — optional content checksum (e.g. SHA-256 hex)
 *     - `storage_provider` — e.g. "s3", "r2", "gcs" (for multi-provider setups)
 *
 * ── raw_payload_ref ──────────────────────────────────────────────────────────
 *
 *   A reference to a raw provider/message payload snapshot stored in object
 *   storage.  Raw payloads may contain sensitive personal content and must be
 *   treated as sensitive-data storage.
 *
 *   Each `raw_payload_ref` row references exactly one `object_asset` row.
 *   The payload type distinguishes between thread-level and message-level
 *   snapshots.
 *
 * ── attachment ───────────────────────────────────────────────────────────────
 *
 *   An email attachment synced from a provider message.  Binary content is
 *   stored in object storage via an `object_asset` reference; this table
 *   holds the attachment metadata and ingestion lifecycle state.
 *
 *   ── Ingestion lifecycle ──────────────────────────────────────────────────
 *
 *     "pending"   — attachment metadata synced; upload to object storage not
 *                   yet started or in progress
 *     "uploaded"  — binary content successfully uploaded to object storage
 *     "failed"    — upload attempt failed; content not available in storage
 *     "skipped"   — attachment was intentionally skipped (e.g. too large,
 *                   unsupported type)
 *
 *   ── Partial-success behavior ─────────────────────────────────────────────
 *
 *     Attachment ingestion state is SEPARATE from message sync state.  A
 *     failed or pending attachment does NOT invalidate the parent message or
 *     thread rows.  The parent message is considered successfully synced even
 *     if one or more of its attachments remain in "pending" or "failed" state.
 *
 *     The `object_asset_id` FK is nullable: it is null until the upload
 *     succeeds.  A failed attachment has `ingestion_state = 'failed'` and
 *     `object_asset_id = null`.
 *
 *   ── Metadata ─────────────────────────────────────────────────────────────
 *
 *     `filename`, `content_type`, and `byte_size` are stored from the
 *     provider metadata at sync time, independent of whether the binary
 *     content has been uploaded.
 */
import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

import { message } from "./thread.ts";
import { thread } from "./thread.ts";

// ---------------------------------------------------------------------------
// object_asset — shared object-storage reference
// ---------------------------------------------------------------------------

export const objectAsset = sqliteTable(
	"object_asset",
	{
		id: text("id").primaryKey(),

		// Object-storage bucket name.
		bucket: text("bucket").notNull(),

		// Stable key within the bucket.  Never a signed/pre-signed URL.
		objectKey: text("object_key").notNull(),

		// MIME type of the stored object.
		contentType: text("content_type"),

		// Size in bytes.
		byteSize: integer("byte_size"),

		// Optional content checksum (e.g. SHA-256 hex).
		checksum: text("checksum"),

		// Storage provider identifier (e.g. "s3", "r2", "gcs").
		storageProvider: text("storage_provider"),

		// Timestamps.
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		// Lookup by bucket + key (for deduplication / reference resolution).
		index("object_asset_bucket_key_idx").on(table.bucket, table.objectKey),
	],
);

// ---------------------------------------------------------------------------
// raw_payload_ref — raw provider/message payload snapshot reference
// ---------------------------------------------------------------------------

export const rawPayloadRef = sqliteTable(
	"raw_payload_ref",
	{
		id: text("id").primaryKey(),

		// Object-storage reference for the raw payload.
		objectAssetId: text("object_asset_id")
			.notNull()
			.references(() => objectAsset.id, { onDelete: "restrict" }),

		// Payload type: "thread" or "message".
		payloadType: text("payload_type", {
			enum: ["thread", "message"],
		}).notNull(),

		// FK to the parent thread (for thread-level payloads).
		// Null for message-level payloads.
		threadId: text("thread_id").references(() => thread.id, {
			onDelete: "cascade",
		}),

		// FK to the parent message (for message-level payloads).
		// Null for thread-level payloads.
		messageId: text("message_id").references(() => message.id, {
			onDelete: "cascade",
		}),

		// Provider that produced this payload (e.g. "google", "microsoft").
		provider: text("provider"),

		// Timestamps.
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		// Enforce payload_type value set.
		check(
			"raw_payload_ref_type_check",
			sql`${table.payloadType} IN ('thread', 'message')`,
		),

		// Exactly one parent must be set: thread-level payloads have thread_id
		// non-null and message_id null; message-level payloads have message_id
		// non-null and thread_id null.  This mirrors the payload_type discriminator
		// and prevents orphaned or ambiguously-parented payload refs.
		check(
			"raw_payload_ref_exactly_one_parent",
			sql`(${table.threadId} IS NULL) != (${table.messageId} IS NULL)`,
		),

		// Lookup by thread.
		index("raw_payload_ref_thread_id_idx").on(table.threadId),

		// Lookup by message.
		index("raw_payload_ref_message_id_idx").on(table.messageId),
	],
);

// ---------------------------------------------------------------------------
// attachment — email attachment with ingestion lifecycle
// ---------------------------------------------------------------------------

export const attachment = sqliteTable(
	"attachment",
	{
		id: text("id").primaryKey(),

		// Parent message.
		messageId: text("message_id")
			.notNull()
			.references(() => message.id, { onDelete: "cascade" }),

		// -----------------------------------------------------------------------
		// Attachment metadata (from provider, available before upload)
		// -----------------------------------------------------------------------
		// Original filename from the provider.
		filename: text("filename"),

		// MIME type from the provider.
		contentType: text("content_type"),

		// Size in bytes from the provider metadata.
		byteSize: integer("byte_size"),

		// Provider-side attachment identifier (opaque string).
		providerAttachmentId: text("provider_attachment_id"),

		// -----------------------------------------------------------------------
		// Ingestion lifecycle state
		// -----------------------------------------------------------------------
		// Separate from message sync state — a failed attachment does NOT
		// invalidate the parent message.
		//
		// "pending"  — metadata synced; upload not yet started or in progress
		// "uploaded" — binary content successfully uploaded to object storage
		// "failed"   — upload attempt failed; content not available
		// "skipped"  — intentionally skipped (e.g. too large, unsupported type)
		ingestionState: text("ingestion_state", {
			enum: ["pending", "uploaded", "failed", "skipped"],
		})
			.notNull()
			.default("pending"),

		// -----------------------------------------------------------------------
		// Object-storage reference (nullable until upload succeeds)
		// -----------------------------------------------------------------------
		// Null when ingestion_state is "pending", "failed", or "skipped".
		// Set to the object_asset row when ingestion_state = "uploaded".
		objectAssetId: text("object_asset_id").references(() => objectAsset.id, {
			onDelete: "set null",
		}),

		// Optional error message captured when ingestion_state = "failed".
		ingestionError: text("ingestion_error"),

		// -----------------------------------------------------------------------
		// Timestamps
		// -----------------------------------------------------------------------
		uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// ── Ingestion lifecycle invariants ──────────────────────────────────────

		// Enforce ingestion_state value set.
		check(
			"attachment_ingestion_state_check",
			sql`${table.ingestionState} IN ('pending', 'uploaded', 'failed', 'skipped')`,
		),

		// Uploaded attachments MUST have an object_asset_id.
		check(
			"attachment_uploaded_needs_asset",
			sql`(${table.ingestionState} != 'uploaded' OR ${table.objectAssetId} IS NOT NULL)`,
		),

		// Uploaded attachments MUST have an uploaded_at timestamp.
		// This is the inverse of the above: if ingestion_state = 'uploaded',
		// uploaded_at must be set to record when the upload completed.
		check(
			"attachment_uploaded_needs_timestamp",
			sql`(${table.ingestionState} != 'uploaded' OR ${table.uploadedAt} IS NOT NULL)`,
		),

		// ── Indexes ─────────────────────────────────────────────────────────────

		// All attachments for a message.
		index("attachment_message_id_idx").on(table.messageId),

		// Attachments by ingestion state (for retry / monitoring queries).
		index("attachment_ingestion_state_idx").on(table.ingestionState),

		// Attachments by object asset (for storage reference lookups).
		index("attachment_object_asset_id_idx").on(table.objectAssetId),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const objectAssetRelations = relations(objectAsset, ({ many }) => ({
	attachments: many(attachment),
	rawPayloadRefs: many(rawPayloadRef),
}));

export const rawPayloadRefRelations = relations(rawPayloadRef, ({ one }) => ({
	objectAsset: one(objectAsset, {
		fields: [rawPayloadRef.objectAssetId],
		references: [objectAsset.id],
	}),
	thread: one(thread, {
		fields: [rawPayloadRef.threadId],
		references: [thread.id],
	}),
	message: one(message, {
		fields: [rawPayloadRef.messageId],
		references: [message.id],
	}),
}));

export const attachmentRelations = relations(attachment, ({ one }) => ({
	message: one(message, {
		fields: [attachment.messageId],
		references: [message.id],
	}),
	objectAsset: one(objectAsset, {
		fields: [attachment.objectAssetId],
		references: [objectAsset.id],
	}),
}));
