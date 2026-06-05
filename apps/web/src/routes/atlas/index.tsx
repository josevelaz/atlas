// Atlas — first-run entry (`/atlas`).
//
// `/atlas` is the dedicated Atlas experience root: on first run it shows the
// onboarding walkthrough. The current step is driven by the `?step=N` search
// param (0-based) so every step is server-renderable and observable without
// client hydration (the app has a documented pre-existing TanStack Start/Solid
// hydration error). Skip / Open Atlas land on `/atlas/inbox`.

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

export const Route = createFileRoute("/atlas/")({
	validateSearch: (search: Record<string, unknown>): OnboardingSearch => ({
		step: asStep(search.step),
	}),
	component: AtlasEntry,
});

function AtlasEntry() {
	const search = Route.useSearch();
	return <Onboarding step={search().step} basePath="/atlas" />;
}
