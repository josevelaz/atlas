import { createFileRoute, redirect } from "@tanstack/solid-router";
import { HayInboxDemo } from "../../components/hay-demo/hay-inbox-demo";
import { authClient } from "../../lib/auth";

/**
 * /dev/hay-inbox — Protected internal demo route.
 *
 * Recreates the Hay inbox prototype (docs/prototype/hay-inbox-prototype.html)
 * as a high-fidelity SolidJS demo. This is an INTERNAL demo surface, separate
 * from production navigation — it does not replace any existing route.
 *
 * Protection: the global guard in __root.tsx already redirects any non-/auth
 * path to sign-in when there is no active session. This route also declares an
 * explicit beforeLoad guard (mirroring /onboarding) so the protection is local,
 * obvious, and resilient to future root-guard changes.
 */
export const Route = createFileRoute("/dev/hay-inbox")({
	// Optional ?step=N deep-link into a specific onboarding step (1-based).
	// Read here so it works under SSR as well as client navigation.
	validateSearch: (search: Record<string, unknown>) => ({
		step:
			typeof search.step === "string" || typeof search.step === "number"
				? Number(search.step)
				: undefined,
	}),
	beforeLoad: async () => {
		// Skip auth check during SSR — only enforce on the client.
		if (import.meta.env.SSR) return;

		const signInRedirect = redirect({
			to: "/auth/sign-in",
			search: { redirect: "/dev/hay-inbox" },
		});
		try {
			const session = await authClient.getSession();
			if (!session?.data?.session) {
				throw signInRedirect;
			}
		} catch (err) {
			if (err && typeof err === "object" && "to" in err) {
				throw err;
			}
			throw signInRedirect;
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const initialStep = () => {
		const s = search().step;
		return typeof s === "number" && Number.isFinite(s) ? s - 1 : 0;
	};
	return <HayInboxDemo initialStep={initialStep()} />;
}
