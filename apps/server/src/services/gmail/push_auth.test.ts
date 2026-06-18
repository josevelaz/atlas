import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { generateKeyPair, SignJWT } from "jose";

import * as schema from "../../db/schema.ts";
import {
	decodePushEnvelope,
	GOOGLE_OIDC_ISSUER,
	handleGmailPush,
	processPushNotification,
	type PushAuthConfig,
	type PushSyncJobPayload,
	type PushSyncJobs,
	verifyPushAuthorization,
} from "./push_auth.ts";

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../../drizzle");

const AUDIENCE = "https://api.atlas.example.com/gmail/push";
const SERVICE_ACCOUNT = "gmail-push@atlas-prod.iam.gserviceaccount.com";

const AUTH_CONFIG: PushAuthConfig = {
	audience: AUDIENCE,
	serviceAccountEmail: SERVICE_ACCOUNT,
};

// ─── JWT helpers ─────────────────────────────────────────────

let signingKey: CryptoKey;
let verificationKey: CryptoKey;
let attackerSigningKey: CryptoKey;

beforeAll(async () => {
	const trusted = await generateKeyPair("RS256");
	signingKey = trusted.privateKey;
	verificationKey = trusted.publicKey;
	const attacker = await generateKeyPair("RS256");
	attackerSigningKey = attacker.privateKey;
});

interface TokenOverrides {
	issuer?: string;
	audience?: string;
	email?: string;
	emailVerified?: boolean;
	/** Seconds from now; negative = already expired. */
	expiresInSeconds?: number;
	signWith?: () => CryptoKey;
}

const makeToken = async (overrides: TokenOverrides = {}): Promise<string> => {
	const nowSeconds = Math.floor(Date.now() / 1000);
	const expiresIn = overrides.expiresInSeconds ?? 3600;
	return new SignJWT({
		email: overrides.email ?? SERVICE_ACCOUNT,
		email_verified: overrides.emailVerified ?? true,
		sub: "1234567890",
	})
		.setProtectedHeader({ alg: "RS256" })
		.setIssuer(overrides.issuer ?? GOOGLE_OIDC_ISSUER)
		.setAudience(overrides.audience ?? AUDIENCE)
		.setIssuedAt(nowSeconds + Math.min(expiresIn, 0) - 60)
		.setExpirationTime(nowSeconds + expiresIn)
		.sign(overrides.signWith?.() ?? signingKey);
};

const bearer = (token: string) => `Bearer ${token}`;

// ─── Pub/Sub envelope helpers ─────────────────────────────────

const makeEnvelope = (payload: unknown) => ({
	message: {
		data: Buffer.from(JSON.stringify(payload)).toString("base64"),
		messageId: "1357924680",
		publishTime: "2026-06-12T10:00:00.000Z",
	},
	subscription: "projects/atlas-prod/subscriptions/gmail-push",
});

// ─── DB harness (same pattern as connect.test.ts) ─────────────

const USER_ID = "user-1";
const AUTH_ACCOUNT_ID = "auth-acc-1";
const MAILBOX = "alice@gmail.com";

const TEST_DB_DIR = mkdtempSync(join(tmpdir(), "atlas-push-auth-test-"));
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

const insertConnectedAccount = async (
	db: TestDb,
	overrides: Partial<typeof schema.connectedAccount.$inferInsert> = {},
) => {
	await db.insert(schema.connectedAccount).values({
		id: "ca-1",
		userId: USER_ID,
		authAccountId: AUTH_ACCOUNT_ID,
		provider: "gmail",
		emailAddress: MAILBOX,
		status: "active",
		syncState: "watching",
		checkpointHistoryId: "987654",
		checkpointAt: new Date(),
		lastSyncedHistoryId: "990000",
		...overrides,
	});
};

const makeJobsStub = () => {
	const enqueued: PushSyncJobPayload[] = [];
	const jobs: PushSyncJobs = {
		enqueueCatchUp: (payload) => {
			enqueued.push(payload);
			return Promise.resolve();
		},
	};
	return { jobs, enqueued };
};

// ─── verifyPushAuthorization ──────────────────────────────────

describe("verifyPushAuthorization", () => {
	const verify = (header: string | null) =>
		verifyPushAuthorization(header, AUTH_CONFIG, { key: verificationKey });

	it("rejects a missing Authorization header", async () => {
		expect(await verify(null)).toEqual({
			ok: false,
			reason: "missing_token",
		});
	});

	it("rejects a non-Bearer Authorization header", async () => {
		expect(await verify("Basic dXNlcjpwYXNz")).toEqual({
			ok: false,
			reason: "missing_token",
		});
	});

	it("rejects a malformed token", async () => {
		expect(await verify(bearer("not-a-jwt"))).toEqual({
			ok: false,
			reason: "invalid_token",
		});
	});

	it("rejects a forged token (signed by an untrusted key)", async () => {
		const forged = await makeToken({ signWith: () => attackerSigningKey });
		expect(await verify(bearer(forged))).toEqual({
			ok: false,
			reason: "invalid_token",
		});
	});

	it("rejects an expired token", async () => {
		const expired = await makeToken({ expiresInSeconds: -3600 });
		expect(await verify(bearer(expired))).toEqual({
			ok: false,
			reason: "expired",
		});
	});

	it("rejects a token with the wrong audience", async () => {
		const wrongAud = await makeToken({
			audience: "https://someone-else.example.com/push",
		});
		expect(await verify(bearer(wrongAud))).toEqual({
			ok: false,
			reason: "wrong_audience",
		});
	});

	it("rejects a token with the wrong issuer", async () => {
		const wrongIss = await makeToken({ issuer: "https://evil.example.com" });
		expect(await verify(bearer(wrongIss))).toEqual({
			ok: false,
			reason: "wrong_issuer",
		});
	});

	it("rejects a token from a different service account", async () => {
		const wrongEmail = await makeToken({
			email: "intruder@other-project.iam.gserviceaccount.com",
		});
		expect(await verify(bearer(wrongEmail))).toEqual({
			ok: false,
			reason: "wrong_service_account",
		});
	});

	it("rejects a token whose email claim is not verified", async () => {
		const unverified = await makeToken({ emailVerified: false });
		expect(await verify(bearer(unverified))).toEqual({
			ok: false,
			reason: "wrong_service_account",
		});
	});

	it("accepts a valid token for the configured service account", async () => {
		const token = await makeToken();
		expect(await verify(bearer(token))).toEqual({
			ok: true,
			serviceAccountEmail: SERVICE_ACCOUNT,
		});
	});
});

// ─── decodePushEnvelope ───────────────────────────────────────

describe("decodePushEnvelope", () => {
	it("extracts only the emailAddress hint and DROPS the payload historyId", () => {
		const hint = decodePushEnvelope(
			makeEnvelope({ emailAddress: "Alice@GMail.com", historyId: 1234567 }),
		);

		// Strict equality: the hint contains the (lowercased) email and
		// nothing else — the payload's historyId is never propagated, so it
		// can never be (mis)used as a sync cursor downstream.
		expect(hint).toEqual({ emailAddress: "alice@gmail.com" });
		expect(hint && "historyId" in hint).toBe(false);
	});

	it("returns null for a non-object body", () => {
		expect(decodePushEnvelope("nope")).toBeNull();
		expect(decodePushEnvelope(null)).toBeNull();
		expect(decodePushEnvelope(42)).toBeNull();
	});

	it("returns null when message.data is missing or not a string", () => {
		expect(decodePushEnvelope({})).toBeNull();
		expect(decodePushEnvelope({ message: {} })).toBeNull();
		expect(decodePushEnvelope({ message: { data: 7 } })).toBeNull();
	});

	it("returns null when message.data is not base64-encoded JSON", () => {
		expect(
			decodePushEnvelope({
				message: { data: Buffer.from("not json").toString("base64") },
			}),
		).toBeNull();
	});

	it("returns null when the decoded payload has no emailAddress", () => {
		expect(decodePushEnvelope(makeEnvelope({ historyId: 99 }))).toBeNull();
		expect(decodePushEnvelope(makeEnvelope({ emailAddress: "" }))).toBeNull();
	});
});

// ─── processPushNotification ──────────────────────────────────

describe("processPushNotification", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("enqueues a history sync for the active connected account", async () => {
		await insertConnectedAccount(db);
		const { jobs, enqueued } = makeJobsStub();

		const result = await processPushNotification(MAILBOX, { db, jobs });

		expect(result.enqueuedConnectedAccountIds).toEqual(["ca-1"]);
		expect(enqueued).toEqual([{ connectedAccountId: "ca-1" }]);
	});

	it("matches the mailbox email case-insensitively", async () => {
		await insertConnectedAccount(db);
		const { jobs, enqueued } = makeJobsStub();

		await processPushNotification("Alice@GMail.com", { db, jobs });

		expect(enqueued).toEqual([{ connectedAccountId: "ca-1" }]);
	});

	it("never puts a historyId in the job payload — the worker owns the cursor", async () => {
		await insertConnectedAccount(db);
		const { jobs, enqueued } = makeJobsStub();

		await processPushNotification(MAILBOX, { db, jobs });

		const payload = enqueued[0];
		expect(payload).toBeDefined();
		// The payload is the account key and nothing else: no historyId, no
		// cursor — gmail_history_sync reads its own persisted cursor.
		expect(Object.keys(payload ?? {})).toEqual(["connectedAccountId"]);
	});

	it("enqueues nothing for disconnected accounts", async () => {
		await insertConnectedAccount(db, {
			status: "disconnected",
			disconnectedAt: new Date(),
		});
		const { jobs, enqueued } = makeJobsStub();

		const result = await processPushNotification(MAILBOX, { db, jobs });

		expect(result.enqueuedConnectedAccountIds).toEqual([]);
		expect(enqueued).toEqual([]);
	});

	it("enqueues nothing for an unknown mailbox", async () => {
		await insertConnectedAccount(db);
		const { jobs, enqueued } = makeJobsStub();

		const result = await processPushNotification("stranger@gmail.com", {
			db,
			jobs,
		});

		expect(result.enqueuedConnectedAccountIds).toEqual([]);
		expect(enqueued).toEqual([]);
	});

	it("enqueues one sync per active account when several users connect the same mailbox", async () => {
		await insertConnectedAccount(db);
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
			id: "ca-2",
			userId: "user-2",
			authAccountId: "auth-acc-2",
		});
		const { jobs, enqueued } = makeJobsStub();

		const result = await processPushNotification(MAILBOX, { db, jobs });

		expect(result.enqueuedConnectedAccountIds.sort()).toEqual(["ca-1", "ca-2"]);
		expect(enqueued).toHaveLength(2);
	});
});

// ─── handleGmailPush (route flow end-to-end) ──────────────────

describe("handleGmailPush", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
		await insertConnectedAccount(db);
	});

	const handle = async (
		authorization: string | null,
		body: unknown,
		jobs: PushSyncJobs,
	) =>
		handleGmailPush(
			{
				authorization,
				rawBody: typeof body === "string" ? body : JSON.stringify(body),
			},
			AUTH_CONFIG,
			{ key: verificationKey, db, jobs },
		);

	it("answers 401 without enqueueing when the token is missing", async () => {
		const { jobs, enqueued } = makeJobsStub();

		const outcome = await handle(
			null,
			makeEnvelope({ emailAddress: MAILBOX }),
			jobs,
		);

		expect(outcome).toEqual({ status: 401, reason: "missing_token" });
		expect(enqueued).toEqual([]);
	});

	it("answers 403 without enqueueing for a forged token", async () => {
		const { jobs, enqueued } = makeJobsStub();
		const forged = await makeToken({ signWith: () => attackerSigningKey });

		const outcome = await handle(
			bearer(forged),
			makeEnvelope({ emailAddress: MAILBOX }),
			jobs,
		);

		expect(outcome).toEqual({ status: 403, reason: "invalid_token" });
		expect(enqueued).toEqual([]);
	});

	it("answers 403 without enqueueing for an expired token", async () => {
		const { jobs, enqueued } = makeJobsStub();
		const expired = await makeToken({ expiresInSeconds: -3600 });

		const outcome = await handle(
			bearer(expired),
			makeEnvelope({ emailAddress: MAILBOX }),
			jobs,
		);

		expect(outcome).toEqual({ status: 403, reason: "expired" });
		expect(enqueued).toEqual([]);
	});

	it("answers 403 without enqueueing for the wrong audience", async () => {
		const { jobs, enqueued } = makeJobsStub();
		const wrongAud = await makeToken({ audience: "https://other.example" });

		const outcome = await handle(
			bearer(wrongAud),
			makeEnvelope({ emailAddress: MAILBOX }),
			jobs,
		);

		expect(outcome).toEqual({ status: 403, reason: "wrong_audience" });
		expect(enqueued).toEqual([]);
	});

	it("enqueues the history sync and acks 204 for a valid token", async () => {
		const { jobs, enqueued } = makeJobsStub();
		const token = await makeToken();

		const outcome = await handle(
			bearer(token),
			makeEnvelope({ emailAddress: MAILBOX, historyId: 4242424242 }),
			jobs,
		);

		expect(outcome).toEqual({
			status: 204,
			enqueuedConnectedAccountIds: ["ca-1"],
		});
		// The (untrusted) payload historyId is nowhere in the enqueued job.
		expect(enqueued).toEqual([{ connectedAccountId: "ca-1" }]);
	});

	it("payload historyId never reaches the persisted cursor", async () => {
		const { jobs } = makeJobsStub();
		const token = await makeToken();

		await handle(
			bearer(token),
			// Attacker-controlled / stale historyId in the envelope.
			makeEnvelope({ emailAddress: MAILBOX, historyId: "999999999" }),
			jobs,
		);

		// Cursor and checkpoint are untouched by the push path — only the
		// history-sync worker advances them, from Gmail API responses.
		const rows = await db.select().from(schema.connectedAccount);
		expect(rows[0]?.lastSyncedHistoryId).toBe("990000");
		expect(rows[0]?.checkpointHistoryId).toBe("987654");
	});

	it("acks 204 without enqueueing when the envelope is unparsable", async () => {
		const { jobs, enqueued } = makeJobsStub();
		const token = await makeToken();

		const outcome = await handle(bearer(token), "{{not json", jobs);

		expect(outcome).toEqual({ status: 204, enqueuedConnectedAccountIds: [] });
		expect(enqueued).toEqual([]);
	});

	it("acks 204 without enqueueing for an unknown mailbox", async () => {
		const { jobs, enqueued } = makeJobsStub();
		const token = await makeToken();

		const outcome = await handle(
			bearer(token),
			makeEnvelope({ emailAddress: "stranger@gmail.com" }),
			jobs,
		);

		expect(outcome).toEqual({ status: 204, enqueuedConnectedAccountIds: [] });
		expect(enqueued).toEqual([]);
	});
});
