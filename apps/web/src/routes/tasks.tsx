// Atlas — Tasks & Dates route (`/tasks`).
//
// A thin view selector: it renders the shared `AtlasApp` shell with the "tasks"
// view. `AtlasApp` swaps the list/pane pair for the full-width Tasks & Dates
// region and owns all shell wiring (top bar, sidebar, screener decisions) —
// this route owns no business state of its own.

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";

export const Route = createFileRoute("/tasks")({
	component: TasksRoute,
});

function TasksRoute() {
	return <AtlasApp view="tasks" />;
}
