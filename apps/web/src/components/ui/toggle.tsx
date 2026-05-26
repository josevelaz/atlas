import type { Component } from "solid-js";
import { Show, createSignal, onMount } from "solid-js";
import { Motion } from "solid-motionone";

export type ToggleProps = {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label?: string;
};

const Toggle: Component<ToggleProps> = (props) => {
	const [duration, setDuration] = createSignal(0.12);

	onMount(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setDuration(0);
		}
	});

	return (
		<div class="inline-flex items-center gap-2">
			<input
				type="checkbox"
				class="sr-only"
				checked={props.checked}
				onChange={() => props.onChange(!props.checked)}
			/>
			{/* Track */}
			<button
				type="button"
				class={`relative flex h-[28px] w-[52px] cursor-pointer items-center rounded-full border-[length:var(--border-w)] border-border transition-colors duration-[var(--duration-base)] ease-[var(--ease-base)] ${
					props.checked ? "bg-main" : "bg-secondary-background"
				}`}
				onClick={() => props.onChange(!props.checked)}
				role="switch"
				aria-checked={props.checked}
			>
				{/* Thumb */}
				<Motion.div
					animate={{ x: props.checked ? "24px" : "2px" }}
					transition={{ duration: duration(), easing: "ease" }}
					class="absolute top-[1px] h-[22px] w-[22px] rounded-[var(--radius)] bg-foreground"
				/>
			</button>
			<Show when={props.label}>
				<span class="text-sm font-[var(--font-weight-base)] text-foreground">
					{props.label}
				</span>
			</Show>
		</div>
	);
};

export { Toggle };
