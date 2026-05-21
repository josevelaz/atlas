import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { config } from "./config.ts";
import { db } from "./db/index.ts";

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite" }),
	basePath: "/api/auth",
	baseURL: config.BETTER_AUTH_URL,
	secret: config.BETTER_AUTH_SECRET,
	trustedOrigins: config.CORS_ALLOWED_ORIGINS,
});
