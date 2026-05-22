import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main class="flex min-h-screen items-center justify-center">
			<h1 class="text-2xl font-bold">Hello from TanStack Start + SolidJS</h1>
		</main>
	);
}
