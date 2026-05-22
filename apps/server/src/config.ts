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

const isLocalhostUrl = (url: string) => {
	try {
		const parsed = new URL(url);
		return ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
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

const NODE_ENV = env
	.get("NODE_ENV")
	.default("development")
	.asEnum(["production", "test", "development"]);

const BETTER_AUTH_SECRET = env.get("BETTER_AUTH_SECRET").required().asString();

const BETTER_AUTH_URL = env
	.get("BETTER_AUTH_URL")
	.default("http://localhost:3000")
	.asString();

const DEFAULT_CORS_ORIGINS = [
	"http://localhost:3000",
	"http://localhost:3001",
	"http://localhost:5173",
];

const rawCorsOrigins = env.get("CORS_ALLOWED_ORIGINS").asString();
const CORS_ALLOWED_ORIGINS: string[] = rawCorsOrigins
	? [
			...new Set(
				rawCorsOrigins
					.split(",")
					.map((o) => o.trim())
					.filter(Boolean),
			),
		]
	: DEFAULT_CORS_ORIGINS;

if (NODE_ENV === "production") {
	if (isLocalhostUrl(BETTER_AUTH_URL)) {
		throw new Error(
			"BETTER_AUTH_URL must not be a localhost URL in production",
		);
	}

	const unsafeOrigins = CORS_ALLOWED_ORIGINS.filter(
		(origin) => origin === "*" || isLocalhostUrl(origin),
	);
	if (unsafeOrigins.length > 0) {
		throw new Error(
			`CORS_ALLOWED_ORIGINS contains unsafe origins in production: ${unsafeOrigins.join(", ")}`,
		);
	}
}

export const config = {
	NODE_ENV,

	PORT: env.get("PORT").default(3000).asPortNumber(),
	API_URL: env
		.get("API_URL")
		.default(`https://${env.get("PUBLIC_DOMAIN").asString()}`)
		.asString(),
	DATABASE_URL,
	DATABASE_AUTH_TOKEN: IS_LOCAL_DATABASE ? undefined : DATABASE_AUTH_TOKEN,
	REDIS_HOST: env.get("REDIS_HOST").default("localhost").asString(),
	REDIS_PORT: env.get("REDIS_PORT").default(6379).asPortNumber(),
	REDIS_KEY_PREFIX: env.get("REDIS_KEY_PREFIX").default("").asString(),
	REDIS_TLS: env.get("REDIS_TLS").default("false").asBool(),
	POSTHOG_API_KEY: env
		.get("POSTHOG_API_KEY")
		.default("it's a secret")
		.asString(),
	POSTHOG_HOST: env.get("POSTHOG_HOST").default("localhost").asString(),
	S3_ENDPOINT: env.get("S3_ENDPOINT").default("localhost").asString(),
	S3_ACCESS_KEY_ID: env.get("S3_ACCESS_KEY_ID").default("minio").asString(),
	S3_SECRET_ACCESS_KEY: env
		.get("S3_SECRET_ACCESS_KEY")
		.default("minio")
		.asString(),
	LOCK_STORE: env
		.get("LOCK_STORE")
		.default("memory")
		.asEnum(["memory", "redis"]),
	BETTER_AUTH_SECRET,
	BETTER_AUTH_URL,
	CORS_ALLOWED_ORIGINS,
};
