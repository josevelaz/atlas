import { createFileRoute } from "@tanstack/solid-router";
import { createQuery } from "@tanstack/solid-query";
import { Motion, Presence } from "solid-motionone";
import { createSignal, Show } from "solid-js";
import { FormDemo } from "../../lib/tanstack/form-demo";

export const Route = createFileRoute("/dev/tanstack-libraries")({
	component: TanStackLibrariesDemo,
});

/**
 * No-op placeholder query that returns static data.
 * Demonstrates QueryClient wiring without network side effects.
 */
function useDemoQuery() {
	return createQuery(() => ({
		queryKey: ["dev", "demo"],
		queryFn: () =>
			Promise.resolve({
				message: "TanStack Query is working!",
				timestamp: Date.now(),
			}),
		staleTime: Number.POSITIVE_INFINITY,
	}));
}

function TanStackLibrariesDemo() {
	const query = useDemoQuery();
	const [showMotion, setShowMotion] = createSignal(true);

	return (
		<main class="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-8">
			<h1 class="text-2xl font-bold text-zinc-100">TanStack Libraries Demo</h1>

			{/* TanStack Query Demo */}
			<section class="flex flex-col gap-3 rounded-lg border border-zinc-800 p-6">
				<h2 class="text-lg font-semibold text-zinc-200">TanStack Query</h2>
				<Show
					when={query.data}
					fallback={<p class="text-sm text-zinc-500">Loading…</p>}
				>
					{(data) => (
						<div class="flex flex-col gap-1">
							<p class="text-sm text-zinc-300">{data().message}</p>
							<p class="text-xs text-zinc-500">
								Status: {query.status} · Fetched at:{" "}
								{new Date(data().timestamp).toLocaleTimeString()}
							</p>
						</div>
					)}
				</Show>
			</section>

			{/* TanStack Form Demo */}
			<section class="flex flex-col gap-3 rounded-lg border border-zinc-800 p-6">
				<h2 class="text-lg font-semibold text-zinc-200">TanStack Form</h2>
				<FormDemo />
			</section>

			{/* Motion (solid-motionone) Demo */}
			<section class="flex flex-col gap-3 rounded-lg border border-zinc-800 p-6">
				<h2 class="text-lg font-semibold text-zinc-200">Motion Animation</h2>
				<button
					type="button"
					onClick={() => setShowMotion((prev) => !prev)}
					class="w-fit rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
				>
					{showMotion() ? "Hide" : "Show"} animated element
				</button>
				<Presence>
					<Show when={showMotion()}>
						<Motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -20 }}
							transition={{ duration: 0.4, easing: "ease-out" }}
							class="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-center"
						>
							<p class="text-lg font-semibold text-white">
								✨ Animated with solid-motionone
							</p>
						</Motion.div>
					</Show>
				</Presence>

				{/* Hover + Press interaction demo */}
				<Motion.div
					hover={{ scale: 1.02 }}
					press={{ scale: 0.98 }}
					class="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-center text-sm text-zinc-300 transition-colors"
				>
					Hover and press me — interactive motion
				</Motion.div>
			</section>
		</main>
	);
}
