import { drizzle } from "drizzle-orm/libsql";

import { config } from "../config.ts";
import * as schema from "./schema/index.ts";

export const db = drizzle({
	connection: {
		url: config.DATABASE_URL,
		...(config.DATABASE_AUTH_TOKEN
			? { authToken: config.DATABASE_AUTH_TOKEN }
			: {}),
	},
	schema,
	casing: "snake_case",
});
