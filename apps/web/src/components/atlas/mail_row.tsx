// Atlas — mail list row.
//
// One row in a category mail list: avatar, sender / subject / preview stack,
// priority + tag chips, and a right-aligned timestamp. Mirrors the prototype's
// `.mail-row` (unread dot, selected = yellow fill, 2-line preview clamp).
//
// Also exports `AtlasAvatar` — the prototype's initials-from-word-boundaries +
// charCode-keyed palette avatar — so the row and the thread view render the
// exact same glyphs/colors as the source-of-truth prototype (the shared
// `ui/Avatar` uses different initials + palette logic).

import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import {
	avatarClasses,
	mailFromClasses,
	mailMetaTextClasses,
	mailPreviewClasses,
	mailRowClasses,
	mailSubjClasses,
	rowTagsClasses,
	tagAppRowClasses,
	tagClasses,
} from "../../lib/atlas/component_classes";
import type { MailItem, MailTag } from "../../lib/atlas/types";
import { cn } from "../../lib/utils";
import { PriorityChip } from "./priority_chip";

/** Prototype avatar palette (docs/prototype/screens.jsx). */
const AVATAR_COLORS = [
	"#7A83FF",
	"#FACC00",
	"#FF4D50",
	"#00D696",
	"#0099FF",
	"#FF7A05",
	"#A985FF",
	"#FF6B9D",
] as const;

/** Initials = first letter of the first two whitespace-delimited words. */
function initials(name: string): string {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((s) => s[0] ?? "")
		.join("")
		.toUpperCase();
}

/** Color keyed off the first char code, matching the prototype. */
function avatarColor(name: string): string {
	const code = name.charCodeAt(0) || 0;
	return AVATAR_COLORS[code % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

export interface AtlasAvatarProps {
	name: string;
	size?: "sm" | "default" | "lg";
}

/** Prototype-faithful avatar (initials + charCode palette). */
export const AtlasAvatar: Component<AtlasAvatarProps> = (props) => {
	const size = () => props.size ?? "default";
	return (
		<div
			// The app-shell retro pass (sticker tilt) is baked into `avatarClasses`
			// via a `[.atlas-app_&]:` ancestor variant.
			class={avatarClasses({ size: size() })}
			style={{ background: avatarColor(props.name) }}
			role="img"
			aria-label={props.name}
		>
			{initials(props.name)}
		</div>
	);
};

/** Human-readable tag label, e.g. "reply-later" → "reply later". */
function tagLabel(tag: MailTag): string {
	return tag.replace("-", " ");
}

export interface MailRowProps {
	mail: MailItem;
	selected: boolean;
	onSelect: (id: string) => void;
}

const MailRow: Component<MailRowProps> = (props) => {
	const mail = () => props.mail;
	const tags = () => mail().tags ?? [];
	const hasChips = () => Boolean(mail().priority || tags().length > 0);

	return (
		<button
			type="button"
			// `group` + `data-unread`/`data-selected` drive the child text/dot
			// state styling (`group-data-[…]` variants on the from/preview/meta
			// classes, plus the `before:` unread dot on the row itself).
			class={cn("group", mailRowClasses)}
			data-unread={mail().unread ? "true" : undefined}
			data-selected={props.selected ? "true" : undefined}
			aria-pressed={props.selected}
			onClick={() => props.onSelect(mail().id)}
		>
			<AtlasAvatar name={mail().from} />
			<div style={{ "min-width": 0 }}>
				<div class={mailFromClasses}>{mail().from}</div>
				<div class={mailSubjClasses}>{mail().subject}</div>
				<div class={mailPreviewClasses}>{mail().preview}</div>
				<Show when={hasChips()}>
					<div class={rowTagsClasses}>
						<Show when={mail().priority}>
							{(p) => <PriorityChip priority={p()} />}
						</Show>
						<For each={tags()}>
							{(tag) => (
								<span class={cn(tagClasses, tagAppRowClasses)}>
									{tagLabel(tag)}
								</span>
							)}
						</For>
					</div>
				</Show>
			</div>
			<div class={mailMetaTextClasses}>{mail().time}</div>
		</button>
	);
};

export { MailRow };
