import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";

import { getAuthClient } from "../lib/auth";

export const Route = createFileRoute("/logout")({
	component: LogoutRoute,
});

function LogoutRoute() {
	const navigate = useNavigate();
	const [error, setError] = createSignal<string | null>(null);

	onMount(() => {
		void getAuthClient().signOut({
			fetchOptions: {
				onSuccess: () => {
					void navigate({ to: "/" });
				},
				onError: (ctx) => {
					setError(ctx.error.message);
				},
			},
		});
	});

	return (
		<main class="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-6 text-[var(--color-text)]">
			<div class="border-2 border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-4 font-mono shadow-[4px_4px_0_0_var(--color-border)]">
				<Show when={error()} fallback={<p>Signing out…</p>}>
					{(message) => <p>Sign-out failed: {message()}</p>}
				</Show>
			</div>
		</main>
	);
}
