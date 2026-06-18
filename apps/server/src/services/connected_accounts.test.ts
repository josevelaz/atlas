import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../db/schema.ts";
import {
	GMAIL_WATCH_SETUP_ATTEMPTS,
	runGmailWatchSetup,
} from "../jobs/gmail_watch.ts";
import {
	CREDENTIAL_PROVIDER_ID,
	type ConnectedAccountRow,
	ConnectedAccountForbiddenError,
	ConnectedAccountNotFoundError,
	decodeJwtPayload,
	disconnectConnectedAccount,
	listConnectedAccounts,
	pickEffectivePrimary,
	setPrimaryConnectedAccount,
	toConnectedAccountDto,
} from "./connected_accounts.ts";
import type { GmailProfile } from "./gmail/client.ts";
import {
	type ConnectJobPayload,
	type ConnectJobs,
	connectGoogleAccount,
} from "./ingestion/connect.ts";

type SetPrimaryDb = Parameters<typeof setPrimaryConnectedAccount>[2];

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../drizzle");

const USER_ID = "user-1";
const AUTH_ACCOUNT_ID = "auth-acc-1";
const CONNECTED_ACCOUNT_ID = "ca-1";

/** Build a structurally valid (unsigned) JWT with the given payload claims. */
const makeIdToken = (claims: Record<string, unknown>): string => {
	const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
		"base64url",
	);
	const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
	return `${header}.${payload}.signature`;
};

const makeRow = (
	overrides: Partial<ConnectedAccountRow> = {},
): ConnectedAccountRow => ({
	id: "acc-1",
	providerId: "google",
	idToken: null,
	isPrimary: false,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	status: null,
	syncState: null,
	lastSyncedAt: null,
	...overrides,
});

/**
 * Real libsql db (temp file) with the actual migrations applied — same
 * harness as `services/ingestion/connect.test.ts` (a file, not `:memory:`,
 * because the libsql client drops its connection between calls).
 */
const TEST_DB_DIR = mkdtempSync(join(tmpdir(), "atlas-connected-accounts-"));
let dbCounter = 0;

afterAll(() => {
	rmSync(TEST_DB_DIR, { recursive: true, force: true });
});

const makeDb = async () => {
	dbCounter += 1;
	const db = drizzle({
		connection: { url: `file:${join(TEST_DB_DIR, `db-${dbCounter}.sqlite`)}` },
		schema,
		casing: "snake_case",
	});
	await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

	await db.insert(schema.user).values({
		id: USER_ID,
		name: "Alice",
		email: "alice@example.com",
	});
	await db.insert(schema.account).values({
		id: AUTH_ACCOUNT_ID,
		accountId: "google-sub-1",
		providerId: "google",
		userId: USER_ID,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
	});

	return db;
};

type TestDb = Awaited<ReturnType<typeof makeDb>>;

const insertConnectedAccount = async (
	db: TestDb,
	overrides: Partial<typeof schema.connectedAccount.$inferInsert> = {},
) => {
	await db.insert(schema.connectedAccount).values({
		id: CONNECTED_ACCOUNT_ID,
		userId: USER_ID,
		authAccountId: AUTH_ACCOUNT_ID,
		provider: "gmail",
		emailAddress: "alice@gmail.com",
		status: "active",
		syncState: "pending",
		checkpointHistoryId: "987654",
		checkpointAt: new Date(),
		...overrides,
	});
};

const insertThreadWithMessage = async (db: TestDb) => {
	await db.insert(schema.thread).values({
		id: "thread-1",
		userId: USER_ID,
		connectedAccountId: CONNECTED_ACCOUNT_ID,
		providerThreadId: "gm-thread-1",
		senderEmail: "sender@example.com",
	});
	await db.insert(schema.message).values({
		id: "msg-1",
		threadId: "thread-1",
		connectedAccountId: CONNECTED_ACCOUNT_ID,
		providerMessageId: "gm-msg-1",
		fromEmail: "sender@example.com",
		sentAt: new Date("2026-06-01T00:00:00.000Z"),
	});
};

const getConnectedAccountRow = async (db: TestDb) => {
	const rows = await db
		.select()
		.from(schema.connectedAccount)
		.where(eq(schema.connectedAccount.id, CONNECTED_ACCOUNT_ID));
	const row = rows[0];
	if (!row) throw new Error("expected a connected_account row");
	return row;
};

const makeStopStub = (impl: () => Promise<void> = () => Promise.resolve()) => {
	let calls = 0;
	return {
		gmail: {
			stop: () => {
				calls += 1;
				return impl();
			},
		},
		stopCalls: () => calls,
	};
};

describe("decodeJwtPayload", () => {
	it("decodes the email claim from a valid token", () => {
		const token = makeIdToken({ email: "alice@gmail.com", sub: "123" });

		expect(decodeJwtPayload(token)).toEqual({
			email: "alice@gmail.com",
			sub: "123",
		});
	});

	it("returns null for a token without a payload segment", () => {
		expect(decodeJwtPayload("not-a-jwt")).toBeNull();
	});

	it("returns null for a payload that is not valid JSON", () => {
		const garbage = Buffer.from("not json {{", "utf8").toString("base64url");

		expect(decodeJwtPayload(`header.${garbage}.sig`)).toBeNull();
	});

	it("returns null for a JSON payload that is not an object", () => {
		const scalar = Buffer.from(JSON.stringify("hello"), "utf8").toString(
			"base64url",
		);

		expect(decodeJwtPayload(`header.${scalar}.sig`)).toBeNull();
	});
});

describe("toConnectedAccountDto", () => {
	it("uses the id token email claim when present", () => {
		const row = makeRow({
			idToken: makeIdToken({ email: "provider@gmail.com" }),
		});

		const dto = toConnectedAccountDto(row, "owner@example.com");

		expect(dto).toEqual({
			id: "acc-1",
			providerId: "google",
			email: "provider@gmail.com",
			isPrimary: false,
			createdAt: "2026-01-01T00:00:00.000Z",
			status: null,
			syncState: null,
			lastSyncedAt: null,
		});
	});

	it("maps the joined sync fields and serialises lastSyncedAt", () => {
		const row = makeRow({
			status: "active",
			syncState: "watching",
			lastSyncedAt: new Date("2026-06-10T08:00:00.000Z"),
		});

		const dto = toConnectedAccountDto(row, "owner@example.com");

		expect(dto.status).toBe("active");
		expect(dto.syncState).toBe("watching");
		expect(dto.lastSyncedAt).toBe("2026-06-10T08:00:00.000Z");
	});

	it("falls back to the user email for a malformed token", () => {
		const row = makeRow({ idToken: "garbage-token" });

		const dto = toConnectedAccountDto(row, "owner@example.com");

		expect(dto.email).toBe("owner@example.com");
	});

	it("falls back to the user email when the email claim is missing", () => {
		const row = makeRow({ idToken: makeIdToken({ sub: "123" }) });

		const dto = toConnectedAccountDto(row, "owner@example.com");

		expect(dto.email).toBe("owner@example.com");
	});

	it("falls back to the user email when the email claim is empty", () => {
		const row = makeRow({ idToken: makeIdToken({ email: "" }) });

		const dto = toConnectedAccountDto(row, "owner@example.com");

		expect(dto.email).toBe("owner@example.com");
	});

	it("falls back to the user email when there is no id token", () => {
		const dto = toConnectedAccountDto(makeRow(), "owner@example.com");

		expect(dto.email).toBe("owner@example.com");
	});

	it("serialises createdAt as an ISO 8601 string", () => {
		const row = makeRow({ createdAt: new Date("2026-06-11T12:34:56.789Z") });

		expect(toConnectedAccountDto(row, "x@y.z").createdAt).toBe(
			"2026-06-11T12:34:56.789Z",
		);
	});
});

describe("pickEffectivePrimary", () => {
	it("returns null for an empty list", () => {
		expect(pickEffectivePrimary([])).toBeNull();
	});

	it("prefers the explicitly flagged row even when it is newer", () => {
		const oldest = makeRow({
			id: "acc-old",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		});
		const flagged = makeRow({
			id: "acc-new",
			isPrimary: true,
			createdAt: new Date("2026-03-01T00:00:00.000Z"),
		});

		expect(pickEffectivePrimary([oldest, flagged])).toBe(flagged);
	});

	it("falls back to the oldest createdAt when nothing is flagged", () => {
		const newer = makeRow({
			id: "acc-b",
			createdAt: new Date("2026-02-01T00:00:00.000Z"),
		});
		const oldest = makeRow({
			id: "acc-c",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		});

		expect(pickEffectivePrimary([newer, oldest])).toBe(oldest);
	});

	it("breaks createdAt ties deterministically by id", () => {
		const createdAt = new Date("2026-01-01T00:00:00.000Z");
		const b = makeRow({ id: "acc-b", createdAt });
		const a = makeRow({ id: "acc-a", createdAt });

		expect(pickEffectivePrimary([b, a])).toBe(a);
		expect(pickEffectivePrimary([a, b])).toBe(a);
	});
});

describe("listConnectedAccounts", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("joins sync status from the connected_account domain row", async () => {
		const lastSyncedAt = new Date("2026-06-10T08:00:00.000Z");
		await insertConnectedAccount(db, {
			syncState: "watching",
			lastSyncedAt,
		});

		const dtos = await listConnectedAccounts(USER_ID, db);

		expect(dtos).toEqual([
			{
				id: AUTH_ACCOUNT_ID,
				providerId: "google",
				email: "alice@example.com",
				isPrimary: true,
				createdAt: "2026-01-01T00:00:00.000Z",
				status: "active",
				syncState: "watching",
				lastSyncedAt: lastSyncedAt.toISOString(),
			},
		]);
	});

	it("returns null sync fields when no domain row exists yet", async () => {
		const dtos = await listConnectedAccounts(USER_ID, db);

		expect(dtos).toHaveLength(1);
		expect(dtos[0]).toMatchObject({
			id: AUTH_ACCOUNT_ID,
			status: null,
			syncState: null,
			lastSyncedAt: null,
		});
	});

	it("reflects a disconnect in the listing", async () => {
		await insertConnectedAccount(db);
		await disconnectConnectedAccount(USER_ID, AUTH_ACCOUNT_ID, {
			db,
			gmail: makeStopStub().gmail,
		});

		const dtos = await listConnectedAccounts(USER_ID, db);

		expect(dtos[0]?.status).toBe("disconnected");
	});

	it("excludes credential rows and marks the oldest account as effective primary", async () => {
		await db.insert(schema.account).values([
			{
				id: "auth-cred-1",
				accountId: USER_ID,
				providerId: CREDENTIAL_PROVIDER_ID,
				userId: USER_ID,
				createdAt: new Date("2025-12-01T00:00:00.000Z"),
			},
			{
				id: "auth-acc-2",
				accountId: "google-sub-2",
				providerId: "google",
				userId: USER_ID,
				createdAt: new Date("2026-02-01T00:00:00.000Z"),
			},
		]);

		const dtos = await listConnectedAccounts(USER_ID, db);

		expect(dtos.map((dto) => dto.id)).toEqual([AUTH_ACCOUNT_ID, "auth-acc-2"]);
		expect(dtos.map((dto) => dto.isPrimary)).toEqual([true, false]);
	});
});

/**
 * Stub for `setPrimaryConnectedAccount`: a transaction whose lookup select
 * resolves to `target` and whose updates are recorded for assertions.
 */
const makeSetPrimaryDbStub = (
	target: { id: string; userId: string; providerId: string } | undefined,
) => {
	const updates: Array<Record<string, unknown>> = [];
	const tx = {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => Promise.resolve(target ? [target] : []),
				}),
			}),
		}),
		update: () => ({
			set: (values: Record<string, unknown>) => ({
				where: () => {
					updates.push(values);
					return Promise.resolve();
				},
			}),
		}),
	};
	const db = {
		transaction: (fn: (txArg: typeof tx) => Promise<void>) => fn(tx),
	};
	return { db: db as unknown as SetPrimaryDb, updates };
};

describe("setPrimaryConnectedAccount", () => {
	it("rejects credential (email/password) rows", async () => {
		const { db, updates } = makeSetPrimaryDbStub({
			id: "acc-cred",
			userId: "user-1",
			providerId: CREDENTIAL_PROVIDER_ID,
		});

		await expect(
			setPrimaryConnectedAccount("user-1", "acc-cred", db),
		).rejects.toThrow(ConnectedAccountForbiddenError);
		expect(updates).toEqual([]);
	});

	it("treats another user's account as not found", async () => {
		const { db, updates } = makeSetPrimaryDbStub({
			id: "acc-1",
			userId: "user-2",
			providerId: "google",
		});

		await expect(
			setPrimaryConnectedAccount("user-1", "acc-1", db),
		).rejects.toThrow(ConnectedAccountNotFoundError);
		expect(updates).toEqual([]);
	});

	it("throws not-found for a missing account", async () => {
		const { db } = makeSetPrimaryDbStub(undefined);

		await expect(
			setPrimaryConnectedAccount("user-1", "acc-missing", db),
		).rejects.toThrow(ConnectedAccountNotFoundError);
	});

	it("clears the previous primary before flagging the target", async () => {
		const { db, updates } = makeSetPrimaryDbStub({
			id: "acc-1",
			userId: "user-1",
			providerId: "google",
		});

		await setPrimaryConnectedAccount("user-1", "acc-1", db);

		expect(updates).toEqual([{ isPrimary: false }, { isPrimary: true }]);
	});
});

describe("disconnectConnectedAccount", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("disconnects, stops the watch, and retains thread and message rows", async () => {
		await insertConnectedAccount(db, {
			syncState: "watching",
			watchExpiration: new Date(Date.now() + 24 * 3600 * 1000),
		});
		await insertThreadWithMessage(db);
		const { gmail, stopCalls } = makeStopStub();

		const result = await disconnectConnectedAccount(USER_ID, AUTH_ACCOUNT_ID, {
			db,
			gmail,
		});

		expect(result).toEqual({
			alreadyDisconnected: false,
			watchStop: "stopped",
		});
		expect(stopCalls()).toBe(1);

		const row = await getConnectedAccountRow(db);
		expect(row.status).toBe("disconnected");
		expect(row.disconnectedAt).toBeInstanceOf(Date);

		// Retention: disconnect is read-only for ingested mail.
		expect(await db.select().from(schema.thread)).toHaveLength(1);
		expect(await db.select().from(schema.message)).toHaveLength(1);
	});

	it("still disconnects when the best-effort watch stop fails", async () => {
		await insertConnectedAccount(db, { syncState: "watching" });
		const stopErrors: unknown[] = [];
		const { gmail, stopCalls } = makeStopStub(() =>
			Promise.reject(new Error("gmail unavailable")),
		);

		const result = await disconnectConnectedAccount(USER_ID, AUTH_ACCOUNT_ID, {
			db,
			gmail,
			onStopError: (error) => stopErrors.push(error),
		});

		expect(result).toEqual({
			alreadyDisconnected: false,
			watchStop: "failed",
		});
		expect(stopCalls()).toBe(1);
		expect(stopErrors).toHaveLength(1);

		const row = await getConnectedAccountRow(db);
		expect(row.status).toBe("disconnected");
		expect(row.disconnectedAt).toBeInstanceOf(Date);
	});

	it("skips the stop call when the account never had a watch", async () => {
		await insertConnectedAccount(db, { syncState: "polling" });
		const { gmail, stopCalls } = makeStopStub();

		const result = await disconnectConnectedAccount(USER_ID, AUTH_ACCOUNT_ID, {
			db,
			gmail,
		});

		expect(result).toEqual({
			alreadyDisconnected: false,
			watchStop: "skipped",
		});
		expect(stopCalls()).toBe(0);
		expect((await getConnectedAccountRow(db)).status).toBe("disconnected");
	});

	it("is idempotent for an already-disconnected account", async () => {
		await insertConnectedAccount(db, { syncState: "watching" });
		const { gmail, stopCalls } = makeStopStub();

		await disconnectConnectedAccount(USER_ID, AUTH_ACCOUNT_ID, { db, gmail });
		const firstDisconnectedAt = (await getConnectedAccountRow(db))
			.disconnectedAt;

		const second = await disconnectConnectedAccount(USER_ID, AUTH_ACCOUNT_ID, {
			db,
			gmail,
		});

		expect(second).toEqual({ alreadyDisconnected: true, watchStop: "skipped" });
		expect(stopCalls()).toBe(1);
		expect((await getConnectedAccountRow(db)).disconnectedAt).toEqual(
			firstDisconnectedAt,
		);
	});

	it("treats another user's account id as not found and leaves it active", async () => {
		await db.insert(schema.user).values({
			id: "user-2",
			name: "Bob",
			email: "bob@example.com",
		});
		await db.insert(schema.account).values({
			id: "auth-acc-2",
			accountId: "google-sub-2",
			providerId: "google",
			userId: "user-2",
		});
		await insertConnectedAccount(db, {
			userId: "user-2",
			authAccountId: "auth-acc-2",
			emailAddress: "bob@gmail.com",
		});
		const { gmail, stopCalls } = makeStopStub();

		await expect(
			disconnectConnectedAccount(USER_ID, "auth-acc-2", { db, gmail }),
		).rejects.toThrow(ConnectedAccountNotFoundError);

		expect(stopCalls()).toBe(0);
		expect((await getConnectedAccountRow(db)).status).toBe("active");
	});

	it("throws not-found for a missing account id", async () => {
		await expect(
			disconnectConnectedAccount(USER_ID, "acc-missing", {
				db,
				gmail: makeStopStub().gmail,
			}),
		).rejects.toThrow(ConnectedAccountNotFoundError);
	});

	it("rejects credential (email/password) rows", async () => {
		await db.insert(schema.account).values({
			id: "auth-cred-1",
			accountId: USER_ID,
			providerId: CREDENTIAL_PROVIDER_ID,
			userId: USER_ID,
		});

		await expect(
			disconnectConnectedAccount(USER_ID, "auth-cred-1", {
				db,
				gmail: makeStopStub().gmail,
			}),
		).rejects.toThrow(ConnectedAccountForbiddenError);
	});

	it("throws not-found when the OAuth account has no connected_account row", async () => {
		await expect(
			disconnectConnectedAccount(USER_ID, AUTH_ACCOUNT_ID, {
				db,
				gmail: makeStopStub().gmail,
			}),
		).rejects.toThrow(ConnectedAccountNotFoundError);
	});

	it("prevents future sync work for the disconnected account", async () => {
		await insertConnectedAccount(db, { syncState: "watching" });
		await disconnectConnectedAccount(USER_ID, AUTH_ACCOUNT_ID, {
			db,
			gmail: makeStopStub().gmail,
		});

		// 1. The watch-setup runner skips disconnected accounts entirely.
		let watchCalls = 0;
		const watchOutcome = await runGmailWatchSetup(
			{ connectedAccountId: CONNECTED_ACCOUNT_ID },
			{ attemptNumber: 1, maxAttempts: GMAIL_WATCH_SETUP_ATTEMPTS },
			{
				db,
				gmail: {
					watch: async () => {
						watchCalls += 1;
						return { historyId: "1", expiration: "1" };
					},
				},
				push: { pushEnabled: true, topicName: "projects/t/topics/x" },
			},
		);

		expect(watchOutcome).toEqual({
			outcome: "skipped",
			reason: "account_disconnected",
		});
		expect(watchCalls).toBe(0);

		// 2. Re-running connect for the same mailbox is a no-op that enqueues
		//    no sync jobs (the connected_account row already exists).
		const catchUp: ConnectJobPayload[] = [];
		const watchSetup: ConnectJobPayload[] = [];
		const jobs: ConnectJobs = {
			enqueueCatchUp: async (payload) => {
				catchUp.push(payload);
			},
			enqueueWatchSetup: async (payload) => {
				watchSetup.push(payload);
			},
		};
		const profile: GmailProfile = {
			emailAddress: "alice@gmail.com",
			messagesTotal: 1,
			threadsTotal: 1,
			historyId: "987654",
		};

		const connectResult = await connectGoogleAccount({
			authAccountId: AUTH_ACCOUNT_ID,
			userId: USER_ID,
			db,
			gmail: { getProfile: () => Promise.resolve(profile) },
			jobs,
		});

		expect(connectResult.created).toBe(false);

		// Let the fire-and-forget post-commit enqueue path settle.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(catchUp).toHaveLength(0);
		expect(watchSetup).toHaveLength(0);
	});
});
