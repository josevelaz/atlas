import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteSolid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	server: {
		port: 3001,
	},
	build: {
		rollupOptions: {
			// Tauri plugin APIs are only available at runtime inside the Tauri shell.
			// Externalize them so the web build doesn't try to bundle them.
			// Dynamic imports of these modules will fail gracefully in the browser
			// (isDesktop() returns false, so they are never called in web builds).
			external: [
				"@tauri-apps/plugin-opener",
				"@tauri-apps/api/event",
				"@tauri-apps/api/core",
			],
		},
	},
	optimizeDeps: {
		exclude: [
			"@tanstack/solid-router",
			"@tanstack/router-core",
			"@tanstack/solid-start",
			"@tanstack/solid-start-client",
			"@tanstack/solid-start-server",
			"@tanstack/start-client-core",
			"@tanstack/start-server-core",
			// Tauri plugin APIs — only available at runtime inside the Tauri shell
			"@tauri-apps/plugin-opener",
			"@tauri-apps/api/event",
			"@tauri-apps/api/core",
		],
	},
	plugins: [
		tailwindcss(),
		tanstackRouter({ target: "solid", autoCodeSplitting: true }),
		tanstackStart({
			spa: { enabled: true, prerender: { outputPath: "/index" } },
		}),
		// solid's vite plugin must come after start's vite plugin
		viteSolid({ ssr: true }),
	],
});
