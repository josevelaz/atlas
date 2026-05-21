import { createDebouncer } from "@tanstack/solid-pacer";

/**
 * Minimal TanStack Pacer demo.
 * Wraps a no-op function with a debouncer — no side effects.
 *
 * Usage in a component:
 * ```tsx
 * const debouncer = createDemoDebouncer();
 * debouncer.maybeExecute("test");
 * ```
 */
export function createDemoDebouncer() {
	const debouncer = createDebouncer(
		(_value: string) => {
			// No-op: demo only
			console.log("[pacer-demo] debounced:", _value);
		},
		{ wait: 300 },
	);

	return debouncer;
}
