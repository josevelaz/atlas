// Atlas — Tasks & Dates route (`/tasks`).
//
// The AI-extracted Tasks & Dates screen. Renders the app shell (top bar +
// sidebar) with the full-width Tasks & Dates region in place of the list/pane
// pair, mirroring the prototype's `view === "tasks"` branch (`gridColumn: 2 /
// 4`).
//
// Screener decisions live in the shared Atlas store, so the sidebar counts (and
// onward mail-screen navigation) stay consistent through provider state — no
// `?d=` token, identical to the mail routes.

import { createFileRoute } from "@tanstack/solid-router";
import { AppShell } from "../components/atlas/app_shell";
import { SidebarNav } from "../components/atlas/sidebar_nav";
import { TasksScreen } from "../components/atlas/tasks_screen";
import { TopBar } from "../components/atlas/top_bar";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

export const Route = createFileRoute("/tasks")({
	component: TasksRoute,
});

function TasksRoute() {
	const noop = () => {};
	const linkFor = atlasMailLinkFor();

	return (
		<AppShell
			topBar={<TopBar onSearch={noop} onCompose={noop} />}
			sidebar={<SidebarNav activeView="tasks" linkFor={linkFor} />}
		>
			<div class="atlas-fullpane">
				<TasksScreen />
			</div>
		</AppShell>
	);
}
