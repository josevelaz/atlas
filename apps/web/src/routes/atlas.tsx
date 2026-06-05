// Atlas — workspace layout route.
//
// Parent route for all `/atlas/*` screens. Currently a thin pass-through that
// renders the active child via `<Outlet />`; it exists so future Atlas screens
// (feed, paper, tasks, settings) can share this segment without touching `/`.

import { createFileRoute, Outlet } from "@tanstack/solid-router";

export const Route = createFileRoute("/atlas")({ component: AtlasLayout });

function AtlasLayout() {
	return <Outlet />;
}
