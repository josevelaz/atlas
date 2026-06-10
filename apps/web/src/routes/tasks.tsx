// Atlas — Tasks & Dates route (`/tasks`).
//
// The AI-extracted Tasks & Dates screen. Renders the app shell (top bar +
// sidebar) with the full-width Tasks & Dates region in place of the list/pane
// pair, mirroring the prototype's `view === "tasks"` branch (`gridColumn: 2 /
// 4`).
//
// Optional `?d=` search param carries the screener accept/reject token-string so
// the sidebar counts (and onward mail-screen navigation) stay consistent under
// the pre-existing broken-hydration constraint — identical to the mail routes.

import { createFileRoute } from "@tanstack/solid-router";
import { AppShell } from "../components/atlas/app_shell";
import { SidebarNav } from "../components/atlas/sidebar_nav";
import { TasksScreen } from "../components/atlas/tasks_screen";
import { TopBar } from "../components/atlas/top_bar";
import { decodeDecisions } from "../lib/atlas/app_state";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

type TasksSearch = {
	d?: string;
};

export const Route = createFileRoute("/tasks")({
	validateSearch: (search: Record<string, unknown>): TasksSearch => ({
		d: typeof search.d === "string" ? search.d : undefined,
	}),
	component: TasksRoute,
});

function TasksRoute() {
	const search = Route.useSearch();
	const decisions = () => decodeDecisions(search().d);
	const noop = () => {};

	// SSR-proof nav: keep the current decisions when moving between screens.
	const linkFor = () => atlasMailLinkFor(search().d);

	return (
		<AppShell
			topBar={<TopBar onSearch={noop} onCompose={noop} />}
			sidebar={
				<SidebarNav
					activeView="tasks"
					decisions={decisions()}
					linkFor={linkFor()}
				/>
			}
		>
			<div class="atlas-fullpane">
				<TasksScreen />
			</div>
		</AppShell>
	);
}
