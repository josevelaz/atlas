import { createSignal } from "solid-js";
import { createHotkey } from "@tanstack/solid-hotkeys";

/**
 * Minimal TanStack Hotkeys demo component.
 * Binds a non-destructive hotkey (Shift+D) that increments a counter.
 * No product actions are triggered.
 */
export function HotkeysDemo() {
	const [count, setCount] = createSignal(0);

	createHotkey("Shift+D", () => {
		setCount((c) => c + 1);
	});

	return (
		<div class="flex flex-col gap-2">
			<p class="text-sm text-zinc-300">
				Press{" "}
				<kbd class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-200">
					Shift+D
				</kbd>{" "}
				to increment the counter.
			</p>
			<p class="text-sm text-zinc-400">
				Count: <span class="font-mono text-zinc-200">{count()}</span>
			</p>
		</div>
	);
}
