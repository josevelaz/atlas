// Atlas — onboarding replay (`/atlas/onboarding`).
//
// The replay entry for the walkthrough, reachable from the sidebar's "Replay
// onboarding" action. Identical to the first-run `/atlas` flow but on its own
// path so replay is a distinct, linkable destination. The active step is owned
// by local client state inside the `Onboarding` component (no `?step=N` query
// param), so each replay starts fresh at step 0. Skip / Open Atlas land on
// `/atlas/inbox`.

import { createFileRoute } from "@tanstack/solid-router";
import { Onboarding } from "../../components/atlas/onboarding";

export const Route = createFileRoute("/atlas/onboarding")({
	component: OnboardingReplay,
});

function OnboardingReplay() {
	return <Onboarding />;
}
