// Atlas — first-run entry (`/`).
//
// `/` is the Atlas experience root: on first run it shows the onboarding
// walkthrough. The active step is owned by local client state inside the
// `Onboarding` component (no `?step=N` query param), so entering `/` always
// starts the walkthrough at step 0. Skip / Open Atlas land on `/inbox`.

import { createFileRoute } from "@tanstack/solid-router";
import { Onboarding } from "../components/atlas/onboarding";

export const Route = createFileRoute("/")({
	component: AtlasEntry,
});

function AtlasEntry() {
	return <Onboarding />;
}
