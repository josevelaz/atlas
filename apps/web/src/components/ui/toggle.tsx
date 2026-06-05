import type { Component } from "solid-js";
import { Show, createSignal, onMount } from "solid-js";
import { Motion } from "solid-motionone";

export type ToggleProps = {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label?: string;
	disabled?: boolean;
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
			<button
				type="button"
				class="atlas-toggle"
				data-on={props.checked}
				disabled={props.disabled}
				onClick={() => !props.disabled && props.onChange(!props.checked)}
				role="switch"
				aria-checked={props.checked}
			>
				<Motion.span
					class="atlas-toggle-thumb"
					animate={{ left: props.checked ? "28px" : "2px" }}
					transition={{ duration: duration(), easing: "ease" }}
				/>
			</button>
			<Show when={props.label}>
				<span class="text-sm text-foreground">{props.label}</span>
			</Show>
		</div>
	);
};

export { Toggle };
