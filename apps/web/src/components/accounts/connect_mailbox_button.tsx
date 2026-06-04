/**
 * ConnectMailboxButton — Gmail mailbox connect CTA.
 *
 * Handles both web and desktop flows:
 *   - Desktop: calls startDesktopMailboxConnect() which opens the system
 *     browser and listens for the mailbox-connect deep-link callback.
 *   - Web: navigates to the server-side connect/start endpoint which
 *     redirects to Google's consent screen.
 *
 * Props:
 *   returnIntent  — path to redirect to after successful connection (default: "/")
 *   onSuccess     — called after a successful desktop connect with { accountId, email }
 *   onError       — called after a failed desktop connect with an error message
 *   class         — additional CSS classes
 */

import { type Component, createSignal, Show } from "solid-js";
import { Button } from "../ui/button";
import { isDesktop } from "../../lib/desktop_auth";
import { apiUrl } from "../../lib/api";

export type ConnectMailboxButtonProps = {
	returnIntent?: string;
	onSuccess?: (result: { accountId: string; email: string }) => void;
	onError?: (message: string) => void;
	class?: string;
};

export const ConnectMailboxButton: Component<ConnectMailboxButtonProps> = (
	props,
) => {
	const [loading, setLoading] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

	const handleClick = async () => {
		if (loading()) return;
		setLoading(true);
		setErrorMsg(null);

		if (isDesktop()) {
			// Desktop flow: open system browser, wait for deep-link callback
			const { startDesktopMailboxConnect } = await import(
				"../../lib/desktop_mailbox"
			);
			await startDesktopMailboxConnect({
				returnIntent: props.returnIntent ?? "/",
				onSuccess: (result) => {
					setLoading(false);
					props.onSuccess?.(result);
				},
				onError: (message) => {
					setLoading(false);
					setErrorMsg(message);
					props.onError?.(message);
				},
			});
		} else {
			// Web flow: POST to connect/start, then navigate to the returned authUrl
			try {
				const res = await fetch(apiUrl("/api/accounts/google/connect/start"), {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({
						returnIntent: props.returnIntent ?? "/",
						channel: "web",
					}),
				});

				if (!res.ok) {
					const body = (await res.json().catch(() => ({}))) as {
						error?: string;
					};
					throw new Error(body.error ?? `Connect start failed: ${res.status}`);
				}

				const { authUrl } = (await res.json()) as { authUrl: string };
				if (!authUrl) throw new Error("No authorization URL returned");

				// Navigate to Google's consent screen
				window.location.href = authUrl;
				// Don't setLoading(false) — we're navigating away
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Mailbox connect failed";
				setLoading(false);
				setErrorMsg(message);
				props.onError?.(message);
			}
		}
	};

	return (
		<div class={props.class}>
			<Button
				variant="primary"
				disabled={loading()}
				onClick={handleClick}
				class="w-full"
			>
				<Show when={loading()} fallback="Connect Gmail">
					Connecting…
				</Show>
			</Button>
			<Show when={errorMsg()}>
				<p class="mt-2 text-xs text-red-600 dark:text-red-400">{errorMsg()}</p>
			</Show>
		</div>
	);
};
