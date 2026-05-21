import { PostHog } from "posthog-node";
import { config } from "../config.ts";

export const posthog = new PostHog(config.POSTHOG_API_KEY, {
	host: config.POSTHOG_HOST,
	disabled: config.NODE_ENV !== "production",
});

posthog.on("error", (err) => {
	console.error("PostHog had an error!", err);
});
