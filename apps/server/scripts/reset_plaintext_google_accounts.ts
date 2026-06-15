import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import { account } from "../src/db/schema.ts";

type AccountTokenRow = {
	id: string;
	userId: string;
	providerAccountId: string | null;
	accessToken: string | null;
	refreshToken: string | null;
};

type DbConfig = {
	url: string;
	authToken?: string;
};

const LOCAL_DATABASE_URL = "http://127.0.0.1:8080";

const isLikelyEncryptedOAuthToken = (token: string): boolean => {
	if (token.startsWith("$ba$")) return true;
	return token.length % 2 === 0 && /^[0-9a-f]+$/i.test(token);
};

const isPlaintextOAuthToken = (token: string | null | undefined): boolean => {
	if (!token) return false;
	return !isLikelyEncryptedOAuthToken(token);
};

const hasPlaintextToken = (
	row: Pick<AccountTokenRow, "accessToken" | "refreshToken">,
): boolean => {
	return (
		isPlaintextOAuthToken(row.accessToken) ||
		isPlaintextOAuthToken(row.refreshToken)
	);
};

const isLocalDatabaseUrl = (url: string): boolean => {
	if (url.startsWith("file:")) return true;
	try {
		const parsed = new URL(url);
		return (
			(parsed.protocol === "http:" || parsed.protocol === "ws:") &&
			["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)
		);
	} catch {
		return false;
	}
};

const toDatabaseConfig = (): DbConfig => {
	const url = process.env.TURSO_DATABASE_URL ?? LOCAL_DATABASE_URL;
	const authToken = process.env.TURSO_AUTH_TOKEN;

	if (!isLocalDatabaseUrl(url)) {
		throw new Error(
			"Refusing to run this dev-only cleanup against non-local DB.",
		);
	}

	return {
		url,
		...(authToken ? { authToken } : {}),
	};
};

const formatRows = (rows: AccountTokenRow[], max = 10): string => {
	return rows
		.slice(0, max)
		.map(
			(row) =>
				`- id=${row.id}, userId=${row.userId}, providerAccountId=${row.providerAccountId ?? "<null>"}`,
		)
		.join("\n");
};

const main = async () => {
	const nodeEnv = process.env.NODE_ENV ?? "development";
	if (nodeEnv !== "development") {
		throw new Error(
			"This maintenance script is dev-only; run with NODE_ENV=development only.",
		);
	}

	const argv = new Set(process.argv.slice(2));
	const apply = argv.has("--apply");
	const dryRun = !apply;

	const config = toDatabaseConfig();
	const db = drizzle({
		connection: {
			url: config.url,
			...(config.authToken ? { authToken: config.authToken } : {}),
		},
		schema: { account },
		casing: "snake_case",
	});

	const googleAccounts = await db
		.select({
			id: account.id,
			userId: account.userId,
			providerAccountId: account.accountId,
			accessToken: account.accessToken,
			refreshToken: account.refreshToken,
		})
		.from(account)
		.where(
			and(
				eq(account.providerId, "google"),
				or(isNotNull(account.accessToken), isNotNull(account.refreshToken)),
			),
		);

	const affectedAccounts = googleAccounts.filter(hasPlaintextToken);

	console.log(
		`Scanned ${googleAccounts.length} google account rows; ${affectedAccounts.length} match plaintext-token criteria.`,
	);

	if (affectedAccounts.length === 0) {
		console.log("No rows to clean. Nothing to do.");
		return;
	}

	console.log("Affected rows:");
	console.log(formatRows(affectedAccounts));
	if (affectedAccounts.length > 10) {
		console.log(`... and ${affectedAccounts.length - 10} more`);
	}

	if (dryRun) {
		console.log(
			"Dry run mode: no rows were deleted. Re-run with --apply to delete these rows.",
		);
		return;
	}

	const deleted = await db.delete(account).where(
		inArray(
			account.id,
			affectedAccounts.map((row) => row.id),
		),
	);

	console.log(
		`${(deleted as { rowsAffected?: number }).rowsAffected ?? affectedAccounts.length} rows deleted.`,
	);
	console.log(
		"Deleting these account rows forces re-consent for affected users on Google OAuth connect flow.",
	);
};

main().catch((error) => {
	console.error(
		`Failed to run reset script: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exit(1);
});
