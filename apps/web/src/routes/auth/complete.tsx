import { createFileRoute, redirect } from "@tanstack/solid-router";
import { apiUrl } from "../../lib/api";

/**
 * /auth/complete — Post-auth branching route.
 *
 * Better Auth redirects here after a successful OAuth flow.
 * This route checks the user's connected account count and branches:
 *   - connectedAccountCount === 0 → redirect to /onboarding
 *   - otherwise → redirect to the `redirect` query param or /
 *
 * The `redirect` param is sanitized: must be a relative path starting with /,
 * no protocol, no //.
 */
export const Route = createFileRoute("/auth/complete")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: (search.redirect as string) ?? undefined,
	}),
	beforeLoad: async ({ search }) => {
		// Skip auth check during SSR — only enforce on the client
		if (import.meta.env.SSR) return;

		// Fetch the current user's connected account count
		let connectedAccountCount = 0;
		try {
			const meRes = await fetch(apiUrl("/me"), { credentials: "include" });
			if (meRes.ok) {
				const me = (await meRes.json()) as { connectedAccountCount: number };
				connectedAccountCount = me.connectedAccountCount;
			}
		} catch {
			// If /me fails, treat as 0 connected accounts → onboarding
		}

		if (connectedAccountCount === 0) {
			throw redirect({ to: "/onboarding" });
		}

		// Sanitize the redirect param: must be relative, start with /, no protocol, no //
		const dest = search.redirect;
		if (
			dest?.startsWith("/") &&
			!dest.startsWith("//") &&
			!dest.includes(":")
		) {
			throw redirect({ to: dest });
		}

		throw redirect({ to: "/" });
	},
	component: CompletePage,
});

function CompletePage() {
	// This component should never render — beforeLoad always redirects.
	return (
		<main class="min-h-screen bg-background flex items-center justify-center">
			<p class="text-muted">Redirecting…</p>
		</main>
	);
}
