import { createFileRoute, redirect } from "@tanstack/solid-router";
import { AuthForm } from "../../components/auth/auth_form";
import { apiUrl } from "../../lib/api";
import { authClient } from "../../lib/auth";

export const Route = createFileRoute("/auth/sign-in")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: (search.redirect as string) ?? undefined,
		error: (search.error as string) ?? undefined,
	}),
	beforeLoad: async ({ search }) => {
		// Skip auth check during SSR — only enforce on the client
		if (import.meta.env.SSR) return;

		// If already authenticated, branch to onboarding or destination
		try {
			const session = await authClient.getSession();
			if (session?.data?.session) {
				// Check connected account count for onboarding branching
				try {
					const meRes = await fetch(apiUrl("/me"), { credentials: "include" });
					if (meRes.ok) {
						const me = (await meRes.json()) as {
							connectedAccountCount: number;
						};
						if (me.connectedAccountCount === 0) {
							throw redirect({ to: "/onboarding" });
						}
					}
				} catch (err) {
					// If it's a redirect, re-throw it
					if (err && typeof err === "object" && "to" in err) {
						throw err;
					}
				}
				// Redirect to destination or home
				const dest = search.redirect;
				if (dest?.startsWith("/") && !dest.startsWith("//")) {
					throw redirect({ to: dest });
				}
				throw redirect({ to: "/" });
			}
		} catch (err) {
			// If it's a redirect, re-throw it
			if (err && typeof err === "object" && "to" in err) {
				throw err;
			}
			// Otherwise ignore — API server may be down, show sign-in page
		}
	},
	component: SignInPage,
});

function SignInPage() {
	const search = Route.useSearch();
	return (
		<AuthForm
			mode="sign-in"
			redirect={search().redirect}
			error={search().error}
		/>
	);
}
