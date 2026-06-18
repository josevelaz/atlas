import { config } from "./config.ts";
import { startGmailIngestionScheduler } from "./jobs/scheduler.ts";
import { app } from "./server.ts";
import { posthog } from "./services/posthog.ts";

const signals = ["SIGINT", "SIGTERM"];

for (const signal of signals) {
	process.on(signal, async () => {
		console.log(`Received ${signal}. Initiating graceful shutdown...`);
		await app.stop();
		await posthog.shutdown();
		process.exit(0);
	});
}

process.on("uncaughtException", (error) => {
	console.error(error);
});

process.on("unhandledRejection", (error) => {
	console.error(error);
});

app.listen(config.PORT, () =>
	console.log(`🦊 Server started at ${app.server?.url.origin}`),
);

// Gmail ingestion workers + repeating sweeps. Fully gated on
// GMAIL_INGESTION_ENABLED inside the scheduler — when the flag is off this
// resolves without touching Redis. Startup failures are logged, never fatal.
startGmailIngestionScheduler()
	.then((result) => {
		if (result.started) {
			console.log(
				`[gmail-ingestion] scheduler started (${result.schedules.length} repeatable sweeps)`,
			);
		}
	})
	.catch((error) => {
		console.error("[gmail-ingestion] scheduler failed to start", error);
	});
