import type { Component, JSX } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../lib/utils";

export type InputProps = {
	class?: string;
} & JSX.InputHTMLAttributes<HTMLInputElement>;

const Input: Component<InputProps> = (raw_props) => {
	const [local, others] = splitProps(raw_props, ["class"]);
	return <input class={cn("atlas-input", local.class)} {...others} />;
};

export type TextareaProps = {
	class?: string;
} & JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea: Component<TextareaProps> = (raw_props) => {
	const [local, others] = splitProps(raw_props, ["class"]);
	return <textarea class={cn("atlas-textarea", local.class)} {...others} />;
};

export { Input, Textarea };
