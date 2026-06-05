import type { Component, JSX } from "solid-js";
import {
	Show,
	createEffect,
	mergeProps,
	onCleanup,
	splitProps,
} from "solid-js";
import { Portal } from "solid-js/web";

import { cn } from "../../lib/utils";

export type DialogProps = {
	open: boolean;
	onClose: () => void;
	/** Close when the backdrop is clicked (default true). */
	closeOnBackdrop?: boolean;
	/** Close when Escape is pressed (default true). */
	closeOnEscape?: boolean;
	class?: string;
	children?: JSX.Element;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "onClose">;

const Dialog: Component<DialogProps> = (raw_props) => {
	const props = mergeProps(
		{ closeOnBackdrop: true, closeOnEscape: true },
		raw_props,
	);
	const [local, others] = splitProps(props, [
		"open",
		"onClose",
		"closeOnBackdrop",
		"closeOnEscape",
		"class",
		"children",
	]);

	createEffect(() => {
		if (!local.open || !local.closeOnEscape) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") local.onClose();
		};
		document.addEventListener("keydown", handler);
		onCleanup(() => document.removeEventListener("keydown", handler));
	});

	return (
		<Show when={local.open}>
			<Portal>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss; Escape handled at document level */}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape handled at document level */}
				<div
					class="atlas-overlay"
					onClick={(e) => {
						if (local.closeOnBackdrop && e.target === e.currentTarget) {
							local.onClose();
						}
					}}
				>
					<div
						class={cn("atlas-overlay-card", local.class)}
						role="dialog"
						aria-modal="true"
						{...others}
					>
						{local.children}
					</div>
				</div>
			</Portal>
		</Show>
	);
};

export type DialogHeaderProps = {
	class?: string;
	children?: JSX.Element;
} & JSX.HTMLAttributes<HTMLDivElement>;

const DialogHeader: Component<DialogHeaderProps> = (raw_props) => {
	const [local, others] = splitProps(raw_props, ["class", "children"]);
	return (
		<div class={cn("atlas-overlay-head", local.class)} {...others}>
			{local.children}
		</div>
	);
};

export type DialogBodyProps = {
	class?: string;
	children?: JSX.Element;
} & JSX.HTMLAttributes<HTMLDivElement>;

const DialogBody: Component<DialogBodyProps> = (raw_props) => {
	const [local, others] = splitProps(raw_props, ["class", "children"]);
	return (
		<div class={cn("atlas-overlay-body", local.class)} {...others}>
			{local.children}
		</div>
	);
};

export { Dialog, DialogHeader, DialogBody };
