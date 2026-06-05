// Atlas — onboarding replay (`/atlas/onboarding`).
//
// The replay entry for the walkthrough, reachable from the sidebar's "Replay
// onboarding" action. Identical to the first-run `/atlas` flow but on its own
// path so replay is a distinct, linkable destination. The current step is
// driven by `?step=N` (0-based) for server-renderable proof without client
// hydration. Skip / Open Atlas land on `/atlas/inbox`.

import { createFileRoute } from "@tanstack/solid-router";
import { Onboarding } from "../../components/atlas/onboarding";

type OnboardingSearch = { step: number };

/** Coerce a query value to a 0-based step index, defaulting to 0. */
function asStep(value: unknown): number {
	const n =
		typeof value === "number"
			? value
			: typeof value === "string"
				? Number.parseInt(value, 10)
				: 0;
	return Number.isFinite(n) && n >= 0 ? n : 0;
}

export const Route = createFileRoute("/atlas/onboarding")({
	validateSearch: (search: Record<string, unknown>): OnboardingSearch => ({
		step: asStep(search.step),
	}),
	component: OnboardingReplay,
});

function OnboardingReplay() {
	const search = Route.useSearch();
	return <Onboarding step={search().step} basePath="/atlas/onboarding" />;
}
