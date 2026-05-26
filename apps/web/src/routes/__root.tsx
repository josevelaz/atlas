/// <reference types="vite/client" />
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRoute,
} from "@tanstack/solid-router";
import { QueryClientProvider } from "@tanstack/solid-query";
import type * as Solid from "solid-js";
import appCss from "../styles.css?url";
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
				href: "https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap",
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
