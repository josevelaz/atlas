/// <reference types="vite/client" />
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRoute,
	redirect,
} from "@tanstack/solid-router";
import { QueryClientProvider } from "@tanstack/solid-query";
import type * as Solid from "solid-js";
import appCss from "../styles.css?url";
import { queryClient } from "../lib/tanstack/query";
import { authClient } from "../lib/auth";

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
				title: "Atlas",
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
				href: "https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap",
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	/**
	 * Global auth guard.
	 *
	 * If the current route path does not start with /auth, check for an active
	 * session. If no session, redirect to /auth/sign-in?redirect=<current-path>.
	 *
	 * Routes under /auth are exempt from this guard — they handle their own
	 * auth state in their own beforeLoad hooks.
	 *
	 * SSR note: auth checks are skipped during server-side rendering (typeof window
	 * === 'undefined') because the API server may not be reachable from the SSR
	 * context. The client-side hydration will re-run beforeLoad and enforce the guard.
	 */
	beforeLoad: async ({ location }) => {
		// Skip auth check during SSR — only enforce on the client
		if (import.meta.env.SSR) return;

		if (!location.pathname.startsWith("/auth")) {
			try {
				const session = await authClient.getSession();
				if (!session?.data?.session) {
					const fullPath = location.pathname + location.search + location.hash;
					const redirectUrl = `/auth/sign-in?redirect=${encodeURIComponent(fullPath)}`;
					throw redirect({ to: redirectUrl as "/" });
				}
			} catch (err) {
				// If it's a redirect, re-throw it
				if (err && typeof err === "object" && "to" in err) {
					throw err;
				}
				// API server down — redirect to sign-in
				const fullPath = location.pathname + location.search + location.hash;
				const redirectUrl = `/auth/sign-in?redirect=${encodeURIComponent(fullPath)}`;
				throw redirect({ to: redirectUrl as "/" });
			}
		}
	},
	component: RootComponent,
});

function RootComponent() {
	return (
		<RootDocument>
			<QueryClientProvider client={queryClient}>
				<Outlet />
			</QueryClientProvider>
		</RootDocument>
	);
}

function RootDocument(props: { children: Solid.JSX.Element }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{props.children}
				<Scripts />
			</body>
		</html>
	);
}
