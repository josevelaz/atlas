// Atlas — first-run entry (`/`).
//
// `/` is the Atlas experience root: on first run it shows the onboarding
// walkthrough. The active step is owned by local client state inside the
// `Onboarding` component (no `?step=N` query param), so entering `/` always
// starts the walkthrough at step 0. Skip / Open Atlas land on `/inbox`.

import { createFileRoute } from "@tanstack/solid-router";
import { Onboarding } from "../components/atlas/onboarding";
import { redirectIfOnboarded } from "../lib/identity/route_guards";

export const Route = createFileRoute("/")({
	beforeLoad: redirectIfOnboarded,
	component: AtlasEntry,
});

function AtlasEntry() {
	return <Onboarding />;
}
