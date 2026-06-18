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

/**
 * Returns true for Tauri custom-protocol origins:
 *   tauri://localhost   (macOS / Linux)
 *   https://tauri.localhost  (Windows)
 *
 * These origins use "localhost" as the hostname but are NOT web-browser
 * localhost origins — they are the Tauri desktop app's custom protocol.
 * They must be allowed in production and must NOT be flagged by the
 * localhost-in-production safety check.
 */
const isTauriOrigin = (url: string) => {
	try {
		const parsed = new URL(url);
		return (
			parsed.protocol === "tauri:" ||
			(parsed.protocol === "https:" && parsed.hostname === "tauri.localhost")
		);
	} catch {
		return false;
	}
};

// TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are the canonical env var names used
// in CI (fetched from AWS Secrets Manager) and in all deployment workflows.
const DATABASE_URL = env
	.get("TURSO_DATABASE_URL")
	.default(LOCAL_DATABASE_URL)
	.asString();
const DATABASE_AUTH_TOKEN = env.get("TURSO_AUTH_TOKEN").asString();
const IS_LOCAL_DATABASE = isLocalDatabaseUrl(DATABASE_URL);

if (!IS_LOCAL_DATABASE && !DATABASE_AUTH_TOKEN) {
	throw new Error(
		"TURSO_AUTH_TOKEN is required for remote libsql databases. " +
			"Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before starting the server.",
	);
}

const NODE_ENV = env
	.get("NODE_ENV")
	.default("development")
	.asEnum(["production", "test", "development"]);

// HAY_ENV distinguishes deployed environments (staging, production, preview-pr-<N>).
// NODE_ENV is always "production" in ECS; HAY_ENV carries the environment-specific value.
const HAY_ENV = env.get("HAY_ENV").default("development").asString();

const BETTER_AUTH_SECRET = env.get("BETTER_AUTH_SECRET").required().asString();

// Google OAuth credentials — optional; when absent, Google sign-in is disabled.
// Set in .env.local for local dev; inject via secrets manager in production.
const GOOGLE_CLIENT_ID = env.get("GOOGLE_CLIENT_ID").asString();
const GOOGLE_CLIENT_SECRET = env.get("GOOGLE_CLIENT_SECRET").asString();

const BETTER_AUTH_URL = env
	.get("BETTER_AUTH_URL")
	.default("http://localhost:3000")
	.asString();

/**
 * Tauri desktop app custom-protocol origins.
 *   tauri://localhost       — macOS and Linux
 *   https://tauri.localhost — Windows
 *
 * These are always included regardless of environment because they are
 * desktop-only origins that cannot be spoofed by a web browser.
 */
const TAURI_ORIGINS = ["tauri://localhost", "https://tauri.localhost"] as const;

const DEFAULT_CORS_ORIGINS = [
	// Local web dev servers
	"http://localhost:3000",
	"http://localhost:3001",
	"http://localhost:5173",
	// Tauri desktop app (always included — see note above)
	...TAURI_ORIGINS,
];

const rawCorsOrigins = env.get("CORS_ALLOWED_ORIGINS").asString();

/**
 * Build the final allowed-origins list.
 *
 * When CORS_ALLOWED_ORIGINS is set (production / staging / preview), we use
 * exactly those origins PLUS the Tauri custom-protocol origins (which are
 * always safe to include).
 *
 * When CORS_ALLOWED_ORIGINS is unset (local dev), we fall back to
 * DEFAULT_CORS_ORIGINS which already includes Tauri origins.
 *
 * Preview deployments: set CORS_ALLOWED_ORIGINS to a comma-separated list
 * that includes the PR-specific preview URL, e.g.:
 *   CORS_ALLOWED_ORIGINS=https://pr-123.preview.hay.example.com,https://hay.example.com
 */
const CORS_ALLOWED_ORIGINS: string[] = rawCorsOrigins
	? [
			...new Set([
				...rawCorsOrigins
					.split(",")
					.map((o) => o.trim())
					.filter(Boolean),
				// Always merge Tauri origins — they are desktop-only and cannot be
				// spoofed by a web browser, so they are safe in all environments.
				...TAURI_ORIGINS,
			]),
		]
	: DEFAULT_CORS_ORIGINS;

// ─────────────────────────────────────────────
// Gmail ingestion
// ─────────────────────────────────────────────

// Master feature flag for the Gmail ingestion pipeline. Defaults to false so
// the server boots unchanged when none of the Gmail env vars are set.
const GMAIL_INGESTION_ENABLED = env
	.get("GMAIL_INGESTION_ENABLED")
	.default("false")
	.asBool();

// Pub/Sub push notification settings — all optional. When any of them is
// missing, push is disabled and ingestion runs in polling-only mode (the
// expected setup for local dev). All three are required to enable push.
const GMAIL_PUBSUB_TOPIC = env.get("GMAIL_PUBSUB_TOPIC").asString();
const GMAIL_PUSH_AUDIENCE = env.get("GMAIL_PUSH_AUDIENCE").asString();
const GMAIL_PUSH_SERVICE_ACCOUNT = env
	.get("GMAIL_PUSH_SERVICE_ACCOUNT")
	.asString();

const GMAIL_POLL_INTERVAL_SECONDS = env
	.get("GMAIL_POLL_INTERVAL_SECONDS")
	.default(120)
	.asIntPositive();
const GMAIL_WATCH_RENEWAL_HOURS = env
	.get("GMAIL_WATCH_RENEWAL_HOURS")
	.default(24)
	.asIntPositive();

/**
 * Push readiness: true only when every Pub/Sub push var is present.
 * When false (and ingestion is enabled), the pipeline must fall back to
 * polling-only mode — never crash.
 */
const GMAIL_PUSH_ENABLED = Boolean(
	GMAIL_PUBSUB_TOPIC && GMAIL_PUSH_AUDIENCE && GMAIL_PUSH_SERVICE_ACCOUNT,
);

if (GMAIL_INGESTION_ENABLED && !GMAIL_PUSH_ENABLED) {
	const missing = [
		["GMAIL_PUBSUB_TOPIC", GMAIL_PUBSUB_TOPIC],
		["GMAIL_PUSH_AUDIENCE", GMAIL_PUSH_AUDIENCE],
		["GMAIL_PUSH_SERVICE_ACCOUNT", GMAIL_PUSH_SERVICE_ACCOUNT],
	]
		.filter(([, value]) => !value)
		.map(([name]) => name);

	console.warn(
		"[gmail-ingestion] Pub/Sub push disabled — missing " +
			`${missing.join(", ")}. ` +
			"Running in polling-only mode " +
			`(poll interval: ${GMAIL_POLL_INTERVAL_SECONDS}s).`,
	);
}

if (NODE_ENV === "production") {
	if (isLocalhostUrl(BETTER_AUTH_URL)) {
		throw new Error(
			"BETTER_AUTH_URL must not be a localhost URL in production",
		);
	}

	// Tauri custom-protocol origins are exempt from the localhost check —
	// they use "localhost" as the hostname but are NOT web-browser localhost
	// origins. They are the Tauri desktop app's custom protocol and are safe
	// to allow in production.
	const unsafeOrigins = CORS_ALLOWED_ORIGINS.filter(
		(origin) =>
			origin === "*" || (isLocalhostUrl(origin) && !isTauriOrigin(origin)),
	);
	if (unsafeOrigins.length > 0) {
		throw new Error(
			`CORS_ALLOWED_ORIGINS contains unsafe origins in production: ${unsafeOrigins.join(", ")}`,
		);
	}
}

export const config = {
	NODE_ENV,
	HAY_ENV,

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
	// S3 / object storage
	// S3_BUCKET and S3_REGION are required for production; sensible defaults for local dev.
	S3_BUCKET: env.get("S3_BUCKET").default("hay-local").asString(),
	S3_REGION: env.get("S3_REGION").default("us-east-1").asString(),
	// Optional key prefix (e.g. "uploads/"). Defaults to empty string (no prefix).
	S3_PREFIX: env.get("S3_PREFIX").default("").asString(),
	// Optional custom endpoint — set for local MinIO or other S3-compatible stores.
	// Leave unset in production to use the real AWS S3 endpoint.
	S3_ENDPOINT: env.get("S3_ENDPOINT").asString(),
	// Long-lived credentials — only needed for local dev / MinIO.
	// In ECS/production, leave unset and rely on the task-role credential chain.
	S3_ACCESS_KEY_ID: env.get("S3_ACCESS_KEY_ID").asString(),
	S3_SECRET_ACCESS_KEY: env.get("S3_SECRET_ACCESS_KEY").asString(),
	LOCK_STORE: env
		.get("LOCK_STORE")
		.default("memory")
		.asEnum(["memory", "redis"]),
	BETTER_AUTH_SECRET,
	BETTER_AUTH_URL,
	CORS_ALLOWED_ORIGINS,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	// Gmail ingestion
	GMAIL_INGESTION_ENABLED,
	GMAIL_PUBSUB_TOPIC,
	GMAIL_PUSH_AUDIENCE,
	GMAIL_PUSH_SERVICE_ACCOUNT,
	GMAIL_POLL_INTERVAL_SECONDS,
	GMAIL_WATCH_RENEWAL_HOURS,
	/** Derived: true when all Pub/Sub push vars are set; false → polling-only. */
	GMAIL_PUSH_ENABLED,
};
