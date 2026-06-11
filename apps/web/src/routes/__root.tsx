/// <reference types="vite/client" />
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRoute,
	useRouter,
} from "@tanstack/solid-router";
import { QueryClientProvider } from "@tanstack/solid-query";
import type * as Solid from "solid-js";
import { onMount } from "solid-js";
import { HydrationScript, isServer } from "solid-js/web";
import appCss from "../styles.css?url";
import { AtlasProvider } from "../lib/atlas/atlas_state";
import { queryClient } from "../lib/tanstack/query";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Hay",
			},
		],
		links: [
			{ rel: "preconnect", href: "https://fonts.googleapis.com" },
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Bungee&family=Space+Mono:wght@400;700&family=VT323&display=swap",
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	component: RootComponent,
});

function RootComponent() {
	const router = useRouter();

	// Route guards (`lib/identity/route_guards.ts`) are no-ops during SSR so
	// rendering the shell never fetches identity. The server marks `beforeLoad`
	// as already run, so hydration alone would never execute the guards for a
	// direct page load — re-run matched routes once on the client so auth
	// redirects apply to initial loads, not just SPA navigations.
	onMount(() => {
		if (!isServer) {
			void router.invalidate();
		}
	});

	return (
		<RootDocument>
			<QueryClientProvider client={queryClient}>
				<AtlasProvider>
					<Outlet />
				</AtlasProvider>
			</QueryClientProvider>
		</RootDocument>
	);
}

function RootDocument(props: { children: Solid.JSX.Element }) {
	return (
		<html lang="en">
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body>
				{props.children}
				<Scripts />
			</body>
		</html>
	);
}
