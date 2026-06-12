import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../../db/schema.ts";
import type { GmailProfile } from "../gmail/client.ts";
import {
	ConnectionCheckpointError,
	type ConnectJobPayload,
	type ConnectJobs,
	connectGoogleAccount,
	handleAccountCreated,
} from "./connect.ts";

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../../drizzle");

const USER_ID = "user-1";
const AUTH_ACCOUNT_ID = "auth-acc-1";

const PROFILE: GmailProfile = {
	emailAddress: "Alice@GMail.com",
	messagesTotal: 1204,
	threadsTotal: 311,
	historyId: "987654",
};

/**
 * Real libsql db (temp file) with the actual migrations applied.
 *
 * A file — not `:memory:` — because the libsql sqlite3 client drops its
 * connection after every `transaction()` call, which would discard an
 * in-memory database mid-test.
 */
const TEST_DB_DIR = mkdtempSync(join(tmpdir(), "atlas-connect-test-"));
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
	});

	return db;
};

type TestDb = Awaited<ReturnType<typeof makeDb>>;

const makeGmailStub = (profile: GmailProfile = PROFILE) => {
	let calls = 0;
	return {
		gmail: {
			getProfile: () => {
				calls += 1;
				return Promise.resolve(profile);
			},
		},
		profileCalls: () => calls,
	};
};

const makeJobsRecorder = () => {
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
	return { jobs, catchUp, watchSetup };
};

/** Let the fire-and-forget post-commit enqueue settle. */
const flushEnqueues = () => new Promise((resolve) => setTimeout(resolve, 0));

const listRows = (db: TestDb) => db.select().from(schema.connectedAccount);

describe("connectGoogleAccount", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("persists the connected account and checkpoint atomically and enqueues both jobs", async () => {
		const { gmail } = makeGmailStub();
		const { jobs, catchUp, watchSetup } = makeJobsRecorder();

		const result = await connectGoogleAccount({
			authAccountId: AUTH_ACCOUNT_ID,
			userId: USER_ID,
			db,
			gmail,
			jobs,
		});

		expect(result.created).toBe(true);

		const rows = await listRows(db);
		expect(rows).toHaveLength(1);
		const row = rows[0];
		if (!row) throw new Error("expected a connected_account row");

		expect(row.id).toBe(result.connectedAccountId);
		expect(row.userId).toBe(USER_ID);
		expect(row.authAccountId).toBe(AUTH_ACCOUNT_ID);
		expect(row.provider).toBe("gmail");
		expect(row.emailAddress).toBe("alice@gmail.com");
		expect(row.status).toBe("active");
		expect(row.syncState).toBe("pending");
		expect(row.checkpointHistoryId).toBe("987654");
		expect(row.checkpointAt).toBeInstanceOf(Date);

		await flushEnqueues();
		expect(catchUp).toEqual([{ connectedAccountId: row.id }]);
		expect(watchSetup).toEqual([{ connectedAccountId: row.id }]);
	});

	it("is an idempotent no-op on duplicate invocation", async () => {
		const { gmail } = makeGmailStub();
		const { jobs, catchUp, watchSetup } = makeJobsRecorder();
		const params = {
			authAccountId: AUTH_ACCOUNT_ID,
			userId: USER_ID,
			db,
			gmail,
			jobs,
		};

		const first = await connectGoogleAccount(params);
		const second = await connectGoogleAccount(params);

		expect(first.created).toBe(true);
		expect(second.created).toBe(false);
		expect(second.connectedAccountId).toBe(first.connectedAccountId);

		expect(await listRows(db)).toHaveLength(1);

		await flushEnqueues();
		expect(catchUp).toHaveLength(1);
		expect(watchSetup).toHaveLength(1);
	});

	it("resolves to the existing row when another auth account already connected the same mailbox", async () => {
		// Same mailbox email reached through a different Better Auth account
		// row — the (user, email, provider) unique key makes it a no-op.
		await db.insert(schema.account).values({
			id: "auth-acc-2",
			accountId: "google-sub-2",
			providerId: "google",
			userId: USER_ID,
		});

		const { gmail } = makeGmailStub();
		const { jobs, catchUp, watchSetup } = makeJobsRecorder();

		const first = await connectGoogleAccount({
			authAccountId: AUTH_ACCOUNT_ID,
			userId: USER_ID,
			db,
			gmail,
			jobs,
		});
		const second = await connectGoogleAccount({
			authAccountId: "auth-acc-2",
			userId: USER_ID,
			db,
			gmail,
			jobs,
		});

		expect(second.created).toBe(false);
		expect(second.connectedAccountId).toBe(first.connectedAccountId);
		expect(await listRows(db)).toHaveLength(1);

		await flushEnqueues();
		expect(catchUp).toHaveLength(1);
		expect(watchSetup).toHaveLength(1);
	});

	it("leaves no connected_account row and enqueues nothing when the profile fetch fails", async () => {
		const { jobs, catchUp, watchSetup } = makeJobsRecorder();
		const gmail = {
			getProfile: () => Promise.reject(new Error("gmail unavailable")),
		};

		await expect(
			connectGoogleAccount({
				authAccountId: AUTH_ACCOUNT_ID,
				userId: USER_ID,
				db,
				gmail,
				jobs,
			}),
		).rejects.toBeInstanceOf(ConnectionCheckpointError);

		expect(await listRows(db)).toHaveLength(0);

		await flushEnqueues();
		expect(catchUp).toHaveLength(0);
		expect(watchSetup).toHaveLength(0);
	});

	it("leaves no connected_account row and surfaces the error when persistence fails", async () => {
		const { gmail } = makeGmailStub();
		const { jobs, catchUp, watchSetup } = makeJobsRecorder();
		const failingDb = {
			...db,
			transaction: () => Promise.reject(new Error("disk I/O error")),
		} as unknown as TestDb;

		await expect(
			connectGoogleAccount({
				authAccountId: AUTH_ACCOUNT_ID,
				userId: USER_ID,
				db: failingDb,
				gmail,
				jobs,
			}),
		).rejects.toBeInstanceOf(ConnectionCheckpointError);

		expect(await listRows(db)).toHaveLength(0);

		await flushEnqueues();
		expect(catchUp).toHaveLength(0);
		expect(watchSetup).toHaveLength(0);
	});

	it("reports enqueue failures without failing the connection", async () => {
		const { gmail } = makeGmailStub();
		const enqueueErrors: unknown[] = [];
		const jobs: ConnectJobs = {
			enqueueCatchUp: () => Promise.reject(new Error("redis down")),
			enqueueWatchSetup: async () => {},
		};

		const result = await connectGoogleAccount({
			authAccountId: AUTH_ACCOUNT_ID,
			userId: USER_ID,
			db,
			gmail,
			jobs,
			onEnqueueError: (error) => enqueueErrors.push(error),
		});

		expect(result.created).toBe(true);
		expect(await listRows(db)).toHaveLength(1);

		await flushEnqueues();
		expect(enqueueErrors).toHaveLength(1);
		expect(enqueueErrors[0]).toBeInstanceOf(Error);
	});
});

describe("handleAccountCreated", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("connects the mailbox for google account rows", async () => {
		const { gmail } = makeGmailStub();
		const { jobs, catchUp, watchSetup } = makeJobsRecorder();

		const result = await handleAccountCreated(
			{ id: AUTH_ACCOUNT_ID, providerId: "google", userId: USER_ID },
			{ db, gmail, jobs },
		);

		expect(result?.created).toBe(true);
		expect(await listRows(db)).toHaveLength(1);

		await flushEnqueues();
		expect(catchUp).toHaveLength(1);
		expect(watchSetup).toHaveLength(1);
	});

	it("ignores non-google providers without touching Gmail or the db", async () => {
		const { gmail, profileCalls } = makeGmailStub();
		const { jobs, catchUp, watchSetup } = makeJobsRecorder();

		const result = await handleAccountCreated(
			{ id: "auth-cred-1", providerId: "credential", userId: USER_ID },
			{ db, gmail, jobs },
		);

		expect(result).toBeNull();
		expect(profileCalls()).toBe(0);
		expect(await listRows(db)).toHaveLength(0);

		await flushEnqueues();
		expect(catchUp).toHaveLength(0);
		expect(watchSetup).toHaveLength(0);
	});

	it("is idempotent across repeated hook invocations", async () => {
		const { gmail } = makeGmailStub();
		const { jobs, catchUp, watchSetup } = makeJobsRecorder();
		const event = {
			id: AUTH_ACCOUNT_ID,
			providerId: "google",
			userId: USER_ID,
		};

		const first = await handleAccountCreated(event, { db, gmail, jobs });
		const second = await handleAccountCreated(event, { db, gmail, jobs });

		expect(first?.created).toBe(true);
		expect(second?.created).toBe(false);
		expect(second?.connectedAccountId).toBe(first?.connectedAccountId);
		expect(await listRows(db)).toHaveLength(1);

		await flushEnqueues();
		expect(catchUp).toHaveLength(1);
		expect(watchSetup).toHaveLength(1);
	});
});
