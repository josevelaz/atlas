// Atlas — workspace layout route.
//
// Parent route for all `/atlas/*` screens. A thin pass-through that renders the
// active child via `<Outlet />`; it exists so the Atlas screens (onboarding,
// inbox, and future feed / paper / tasks / settings) share this segment without
// touching `/`.
//
// `/atlas` itself (the index child) is the first-run onboarding entry; the
// replay flow lives at `/atlas/onboarding`. Both render the same walkthrough.

import { createFileRoute, Outlet } from "@tanstack/solid-router";

export const Route = createFileRoute("/atlas")({ component: AtlasLayout });

function AtlasLayout() {
	return <Outlet />;
}
