import { Store } from "@tanstack/solid-store";

/**
 * Minimal TanStack Store demo.
 * A tiny local counter store — not product state.
 */
export const demoCounterStore = new Store(0);

/**
 * Store with actions demo.
 * Demonstrates the actions factory pattern.
 */
export const demoValueStore = new Store(
	{ value: "hello" },
	(store: {
		setState: (updater: (prev: { value: string }) => { value: string }) => void;
		get: () => { value: string };
	}) => ({
		reset: () => store.setState(() => ({ value: "hello" })),
		update: (next: string) => store.setState(() => ({ value: next })),
	}),
);
