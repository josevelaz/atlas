import type { Config } from "drizzle-kit";
import env from "env-var";

const LOCAL_DATABASE_URL = "http://127.0.0.1:8080";

const isLocalDatabaseUrl = (url: string) => {
	if (url.startsWith("file:")) {
		return true;
	}

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

const DATABASE_URL = env
	.get("DATABASE_URL")
	.default(LOCAL_DATABASE_URL)
	.asString();
const DATABASE_AUTH_TOKEN = env.get("DATABASE_AUTH_TOKEN").asString();
const IS_LOCAL_DATABASE = isLocalDatabaseUrl(DATABASE_URL);

if (!IS_LOCAL_DATABASE && !DATABASE_AUTH_TOKEN) {
	throw new Error(
		"DATABASE_AUTH_TOKEN is required for remote libsql databases",
	);
}

export default {
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "turso",
	casing: "snake_case",
	dbCredentials: {
		url: DATABASE_URL,
		...(!IS_LOCAL_DATABASE && DATABASE_AUTH_TOKEN
			? { authToken: DATABASE_AUTH_TOKEN }
			: {}),
	},
} satisfies Config;
