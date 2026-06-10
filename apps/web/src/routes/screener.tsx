// Atlas — Screener route (`/screener`).
//
// The first-time-sender triage screen. Renders the app shell (top bar +
// sidebar) with the full-width screener region in place of the list/pane pair,
// mirroring the prototype's `view === "screener"` branch (`gridColumn: 2 / 4`).
//
// Screener decisions are carried in the `?d=` search param (a compact token
// string — `id:category` for accepts, `id:x` for rejects). Client hydration is
// disabled by a pre-existing TanStack/Solid error, so every Accept / Reject is
// a `<Link>` that appends its decision to `?d=`: the pending list shrinks, the
// "Screener clear" empty state appears once all are decided, the sidebar counts
// update, and accepted items flow into `/inbox` (and Feed / Paper Trail)
// via the shared derivation helpers in `app_state.ts`.

import { createFileRoute } from "@tanstack/solid-router";
import { AppShell } from "../components/atlas/app_shell";
import { ScreenerScreen } from "../components/atlas/screener_screen";
import { SidebarNav } from "../components/atlas/sidebar_nav";
import { TopBar } from "../components/atlas/top_bar";
import { decodeDecisions } from "../lib/atlas/app_state";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

type ScreenerSearch = {
	d?: string;
};

export const Route = createFileRoute("/screener")({
	validateSearch: (search: Record<string, unknown>): ScreenerSearch => ({
		d: typeof search.d === "string" ? search.d : undefined,
	}),
	component: ScreenerRoute,
});

function ScreenerRoute() {
	const search = Route.useSearch();
	const decisions = () => decodeDecisions(search().d);
	const noop = () => {};

	// SSR-proof nav: keep the current decisions when moving between mail screens.
	const linkFor = () => atlasMailLinkFor(search().d);

	return (
		<AppShell
			topBar={<TopBar onSearch={noop} onCompose={noop} />}
			sidebar={
				<SidebarNav
					activeView="screener"
					decisions={decisions()}
					linkFor={linkFor()}
				/>
			}
		>
			<div class="atlas-list is-wide">
				<ScreenerScreen decisions={decisions()} to="/screener" />
			</div>
		</AppShell>
	);
}
