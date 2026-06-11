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
	// `atlas-input` is a selector hook for the borderless compose-row override
	// (`.atlas-compose-field .atlas-input`).
	return (
		<input class={cn("atlas-input", inputClasses, local.class)} {...others} />
	);
};

export type TextareaProps = {
	class?: string;
} & JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea: Component<TextareaProps> = (raw_props) => {
	const [local, others] = splitProps(raw_props, ["class"]);
	// `atlas-textarea` is a selector hook for the borderless compose-body override
	// (`.atlas-compose-body .atlas-textarea`).
	return (
		<textarea
			class={cn("atlas-textarea", textareaClasses, local.class)}
			{...others}
		/>
	);
};

export { Input, Textarea };
