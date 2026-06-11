import { and, asc, eq, ne } from "drizzle-orm";

import { account, user } from "../db/schema.ts";

/**
 * Connected-accounts service.
 *
 * "Connected accounts" are the OAuth provider rows in the `account` table
 * (Google, etc.). Credential rows (`providerId === "credential"` — email +
 * password) are NOT connected accounts and are always excluded.
 *
 * Testability: this module performs NO db work at import time. The default
 * db client is resolved lazily (importing `../db/index.ts` eagerly would
 * trigger `config.ts` env validation, which requires BETTER_AUTH_SECRET).
 * Both query functions also accept an injectable `dbClient` so tests can
 * pass a stub or an in-memory database.
 */

/** Better Auth's provider id for email/password rows. */
export const CREDENTIAL_PROVIDER_ID = "credential";

type Db = typeof import("../db/index.ts")["db"];

let defaultDb: Db | undefined;

const getDb = async (): Promise<Db> => {
	if (!defaultDb) {
		({ db: defaultDb } = await import("../db/index.ts"));
	}
	return defaultDb;
};

/** Minimal shape of an `account` row needed by the pure helpers. */
export interface ConnectedAccountRow {
	id: string;
	providerId: string;
	idToken: string | null;
	isPrimary: boolean;
	createdAt: Date;
}

export interface ConnectedAccountDto {
	id: string;
	providerId: string;
	/** Provider account email (from the id token), or the user's email. */
	email: string;
	isPrimary: boolean;
	/** ISO 8601 timestamp. */
	createdAt: string;
}

/** Target account does not exist or does not belong to the user. */
export class ConnectedAccountNotFoundError extends Error {
	readonly code = "CONNECTED_ACCOUNT_NOT_FOUND";

	constructor(accountId: string) {
		super(`Connected account not found: ${accountId}`);
		this.name = "ConnectedAccountNotFoundError";
	}
}

/** Target account is a credential (email/password) row, not an OAuth one. */
export class ConnectedAccountForbiddenError extends Error {
	readonly code = "CONNECTED_ACCOUNT_FORBIDDEN";

	constructor(accountId: string) {
		super(`Account is not a connected OAuth account: ${accountId}`);
		this.name = "ConnectedAccountForbiddenError";
	}
}

/**
 * Decode a JWT payload WITHOUT signature verification.
 *
 * Safe here because the id token was stored by our own server-side OAuth
 * flow — we only read a display email from it, we grant nothing based on it.
 * Returns null for anything that isn't a well-formed JWT payload.
 */
export const decodeJwtPayload = (
	token: string,
): Record<string, unknown> | null => {
	const payloadPart = token.split(".")[1];
	if (!payloadPart) {
		return null;
	}

	try {
		const json = Buffer.from(payloadPart, "base64url").toString("utf8");
		const payload: unknown = JSON.parse(json);
		return typeof payload === "object" && payload !== null
			? (payload as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
};

/**
 * Map an account row to its public DTO.
 *
 * Email resolution: the `email` claim of the stored id token, falling back
 * to the owning user's email when the token is absent or unreadable.
 */
export const toConnectedAccountDto = (
	row: ConnectedAccountRow,
	userEmail: string,
): ConnectedAccountDto => {
	const claims = row.idToken ? decodeJwtPayload(row.idToken) : null;
	const emailClaim = claims?.email;
	const email =
		typeof emailClaim === "string" && emailClaim.length > 0
			? emailClaim
			: userEmail;

	return {
		id: row.id,
		providerId: row.providerId,
		email,
		isPrimary: row.isPrimary,
		createdAt: row.createdAt.toISOString(),
	};
};

/**
 * Pick the effective primary account:
 * the explicitly flagged row when one exists, otherwise the oldest by
 * `createdAt` with a deterministic tiebreak on `id`.
 *
 * Returns null only for an empty list — never null when ≥1 account exists.
 */
export const pickEffectivePrimary = <
	T extends Pick<ConnectedAccountRow, "id" | "isPrimary" | "createdAt">,
>(
	accounts: readonly T[],
): T | null => {
	const flagged = accounts.find((row) => row.isPrimary);
	if (flagged) {
		return flagged;
	}

	let oldest: T | null = null;
	for (const row of accounts) {
		if (
			!oldest ||
			row.createdAt.getTime() < oldest.createdAt.getTime() ||
			(row.createdAt.getTime() === oldest.createdAt.getTime() &&
				row.id < oldest.id)
		) {
			oldest = row;
		}
	}
	return oldest;
};

/**
 * List a user's connected (OAuth) accounts as DTOs, with the effective
 * primary marked — even when no row is explicitly flagged yet.
 */
export const listConnectedAccounts = async (
	userId: string,
	dbClient?: Db,
): Promise<ConnectedAccountDto[]> => {
	const db = dbClient ?? (await getDb());

	const [owner, rows] = await Promise.all([
		db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1),
		db
			.select({
				id: account.id,
				providerId: account.providerId,
				idToken: account.idToken,
				isPrimary: account.isPrimary,
				createdAt: account.createdAt,
			})
			.from(account)
			.where(
				and(
					eq(account.userId, userId),
					ne(account.providerId, CREDENTIAL_PROVIDER_ID),
				),
			)
			.orderBy(asc(account.createdAt), asc(account.id)),
	]);

	const userEmail = owner[0]?.email ?? "";
	const effectivePrimary = pickEffectivePrimary(rows);

	return rows.map((row) => ({
		...toConnectedAccountDto(row, userEmail),
		isPrimary: row.id === effectivePrimary?.id,
	}));
};

/**
 * Atomically flag `accountId` as the user's primary connected account.
 *
 * Throws {@link ConnectedAccountNotFoundError} when the account does not
 * exist or is not owned by `userId` (deliberately indistinguishable, to
 * avoid leaking other users' account ids), and
 * {@link ConnectedAccountForbiddenError} for credential rows.
 *
 * The previous primary is cleared first so the partial unique index
 * (`account_user_primary_uq`) is never violated mid-transaction.
 */
export const setPrimaryConnectedAccount = async (
	userId: string,
	accountId: string,
	dbClient?: Db,
): Promise<void> => {
	const db = dbClient ?? (await getDb());

	await db.transaction(async (tx) => {
		const targets = await tx
			.select({
				id: account.id,
				userId: account.userId,
				providerId: account.providerId,
			})
			.from(account)
			.where(eq(account.id, accountId))
			.limit(1);

		const target = targets[0];
		if (!target || target.userId !== userId) {
			throw new ConnectedAccountNotFoundError(accountId);
		}
		if (target.providerId === CREDENTIAL_PROVIDER_ID) {
			throw new ConnectedAccountForbiddenError(accountId);
		}

		await tx
			.update(account)
			.set({ isPrimary: false })
			.where(
				and(
					eq(account.userId, userId),
					ne(account.id, accountId),
					eq(account.isPrimary, true),
				),
			);

		await tx
			.update(account)
			.set({ isPrimary: true })
			.where(eq(account.id, accountId));
	});
};
