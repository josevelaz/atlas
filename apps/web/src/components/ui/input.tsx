import type { Component, JSX } from "solid-js";
import { splitProps } from "solid-js";
import {
	inputClasses,
	textareaClasses,
} from "../../lib/atlas/component_classes";
import { cn } from "../../lib/utils";

export type InputProps = {
	class?: string;
} & JSX.InputHTMLAttributes<HTMLInputElement>;

const Input: Component<InputProps> = (raw_props) => {
	const [local, others] = splitProps(raw_props, ["class"]);
	// The borderless compose-row treatment is now applied by composing
	// `composeFieldInputClasses` onto `class` (last-wins via cn), not a
	// contextual CSS selector. `atlas-input` is kept only as a stable hook.
	return (
		<input class={cn("atlas-input", inputClasses, local.class)} {...others} />
	);
};

export type TextareaProps = {
	class?: string;
} & JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea: Component<TextareaProps> = (raw_props) => {
	const [local, others] = splitProps(raw_props, ["class"]);
	// The borderless compose-body treatment is now applied by composing
	// `composeBodyTextareaClasses` onto `class` (last-wins via cn), not a
	// contextual CSS selector. `atlas-textarea` is kept only as a stable hook.
	return (
		<textarea
			class={cn("atlas-textarea", textareaClasses, local.class)}
			{...others}
		/>
	);
};

export { Input, Textarea };
