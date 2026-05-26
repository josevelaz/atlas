import { createSignal, For } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";

const ITEM_COUNT = 1000;
const ITEM_HEIGHT = 35;

/**
 * Minimal TanStack Virtual demo component.
 * Renders a virtualised list of placeholder rows — no product data.
 */
export function VirtualDemo() {
	const [parentRef, setParentRef] = createSignal<HTMLDivElement | null>(null);

	const virtualizer = createVirtualizer({
		get count() {
			return ITEM_COUNT;
		},
		getScrollElement: () => parentRef(),
		estimateSize: () => ITEM_HEIGHT,
		overscan: 5,
	});

	return (
		<div class="flex flex-col gap-2">
			<p class="text-sm text-zinc-400">
				{ITEM_COUNT} virtualised rows ({ITEM_HEIGHT}px each)
			</p>
			<div
				ref={setParentRef}
				class="max-h-60 overflow-auto rounded-md border border-zinc-700 bg-zinc-900"
			>
				<div
					style={{
						height: `${virtualizer.getTotalSize()}px`,
						width: "100%",
						position: "relative",
					}}
				>
					<For each={virtualizer.getVirtualItems()}>
						{(virtualRow) => (
							<div
								class={`absolute left-0 top-0 flex w-full items-center px-3 text-sm ${
									virtualRow.index % 2 === 0 ? "text-zinc-300" : "text-zinc-400"
								}`}
								style={{
									height: `${virtualRow.size}px`,
									transform: `translateY(${virtualRow.start}px)`,
								}}
							>
								Row {virtualRow.index}
							</div>
						)}
					</For>
				</div>
			</div>
		</div>
	);
}
