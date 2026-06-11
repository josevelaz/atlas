import type { Component } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { Motion } from "solid-motionone";
import {
	toggleClasses,
	toggleThumbClasses,
} from "../../lib/atlas/component_classes";

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
				class={toggleClasses}
				data-on={props.checked}
				disabled={props.disabled}
				onClick={() => !props.disabled && props.onChange(!props.checked)}
				role="switch"
				aria-checked={props.checked}
			>
				{/*
				 * The thumb's resting position is set via the animate target, which
				 * matches the `data-[on]` CSS left values so it renders correctly
				 * server-side and under reduced motion. Motion only drives the
				 * animated transition once hydrated — `left` matches so there is no
				 * jump.
				 */}
				<Motion.span
					class={toggleThumbClasses}
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
