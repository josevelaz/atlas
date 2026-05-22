import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteSolid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	server: {
		port: 3001,
	},
	plugins: [
		tailwindcss(),
		tanstackRouter({ target: "solid", autoCodeSplitting: true }),
		tanstackStart({
			spa: {
				enabled: true,
				prerender: {
					outputPath: "/index",
				},
			},
		}),
		// solid's vite plugin must come after start's vite plugin
		viteSolid({ ssr: true }),
	],
});
