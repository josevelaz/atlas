// Atlas — inline brutalist stroke icon set (SolidJS port of `docs/prototype/icons.jsx`).
//
// The prototype shipped a hand-rolled inline-SVG icon set rather than a library.
// Ported verbatim to SolidJS so the recreated screens render the exact same
// glyphs (stroke widths, paths, viewBox) as the source-of-truth prototype.

import type { Component, JSX } from "solid-js";
import { Match, mergeProps, Switch } from "solid-js";

/** Every icon name supported by the prototype set. */
export type IconName =
	| "inbox"
	| "feed"
	| "paper"
	| "screener"
	| "ai"
	| "search"
	| "tasks"
	| "settings"
	| "archive"
	| "trash"
	| "reply"
	| "reply-all"
	| "forward"
	| "compose"
	| "x"
	| "check"
	| "chevron-down"
	| "chevron-up"
	| "chevron-right"
	| "chevron-left"
	| "star"
	| "bolt"
	| "clock"
	| "calendar"
	| "tag"
	| "send"
	| "user"
	| "google"
	| "outlook"
	| "plus"
	| "menu"
	| "dot"
	| "sparkle"
	| "shield"
	| "hide"
	| "back"
	| "attach";

export interface AtlasIconProps {
	name: IconName;
	size?: number;
	stroke?: number;
	color?: string;
	style?: JSX.CSSProperties;
	class?: string;
}

const AtlasIcon: Component<AtlasIconProps> = (raw_props) => {
	const props = mergeProps(
		{ size: 16, stroke: 2.2, color: "currentColor" },
		raw_props,
	);

	const common = () =>
		({
			width: props.size,
			height: props.size,
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: props.color,
			"stroke-width": props.stroke,
			"stroke-linecap": "round" as const,
			"stroke-linejoin": "round" as const,
			style: props.style,
			class: props.class,
		}) satisfies JSX.SvgSVGAttributes<SVGSVGElement>;

	return (
		<Switch
			fallback={
				<svg {...common()} aria-hidden="true">
					<circle cx="12" cy="12" r="9" />
				</svg>
			}
		>
			<Match when={props.name === "inbox"}>
				<svg {...common()} aria-hidden="true">
					<path d="M3 13l3-8h12l3 8M3 13v6a1 1 0 001 1h16a1 1 0 001-1v-6M3 13h5l1 3h6l1-3h5" />
				</svg>
			</Match>
			<Match when={props.name === "feed"}>
				<svg {...common()} aria-hidden="true">
					<path d="M4 4h12v16H4zM16 8h4v12h-4M7 8h6M7 12h6M7 16h4" />
				</svg>
			</Match>
			<Match when={props.name === "paper"}>
				<svg {...common()} aria-hidden="true">
					<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6M9 8h2" />
				</svg>
			</Match>
			<Match when={props.name === "screener"}>
				<svg {...common()} aria-hidden="true">
					<circle cx="11" cy="11" r="6" />
					<path d="M16 16l5 5M8 11h6M11 8v6" />
				</svg>
			</Match>
			<Match when={props.name === "ai"}>
				<svg {...common()} aria-hidden="true">
					<path d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5z" />
					<path d="M19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
				</svg>
			</Match>
			<Match when={props.name === "search"}>
				<svg {...common()} aria-hidden="true">
					<circle cx="11" cy="11" r="7" />
					<path d="M16 16l5 5" />
				</svg>
			</Match>
			<Match when={props.name === "tasks"}>
				<svg {...common()} aria-hidden="true">
					<path d="M4 6h16M4 12h16M4 18h10" />
					<path d="M3 6l1 1 1-2M3 12l1 1 1-2M3 18l1 1 1-2" />
				</svg>
			</Match>
			<Match when={props.name === "settings"}>
				<svg {...common()} aria-hidden="true">
					<circle cx="12" cy="12" r="3" />
					<path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
				</svg>
			</Match>
			<Match when={props.name === "archive"}>
				<svg {...common()} aria-hidden="true">
					<path d="M3 5h18v4H3zM5 9v11h14V9M9 13h6" />
				</svg>
			</Match>
			<Match when={props.name === "trash"}>
				<svg {...common()} aria-hidden="true">
					<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
				</svg>
			</Match>
			<Match when={props.name === "reply"}>
				<svg {...common()} aria-hidden="true">
					<path d="M9 7L4 12l5 5M4 12h10a6 6 0 016 6v2" />
				</svg>
			</Match>
			<Match when={props.name === "reply-all"}>
				<svg {...common()} aria-hidden="true">
					<path d="M7 7l-4 5 4 5M11 7l-4 5 4 5M11 12h7a4 4 0 014 4v2" />
				</svg>
			</Match>
			<Match when={props.name === "forward"}>
				<svg {...common()} aria-hidden="true">
					<path d="M15 7l5 5-5 5M20 12H10a6 6 0 00-6 6v2" />
				</svg>
			</Match>
			<Match when={props.name === "compose"}>
				<svg {...common()} aria-hidden="true">
					<path d="M4 20h16M5 17l9-9 3 3-9 9H5v-3zM13 5l3 3" />
				</svg>
			</Match>
			<Match when={props.name === "x"}>
				<svg {...common()} aria-hidden="true">
					<path d="M5 5l14 14M19 5L5 19" />
				</svg>
			</Match>
			<Match when={props.name === "check"}>
				<svg {...common()} aria-hidden="true">
					<path d="M4 12l5 5L20 6" />
				</svg>
			</Match>
			<Match when={props.name === "chevron-down"}>
				<svg {...common()} aria-hidden="true">
					<path d="M6 9l6 6 6-6" />
				</svg>
			</Match>
			<Match when={props.name === "chevron-up"}>
				<svg {...common()} aria-hidden="true">
					<path d="M6 15l6-6 6 6" />
				</svg>
			</Match>
			<Match when={props.name === "chevron-right"}>
				<svg {...common()} aria-hidden="true">
					<path d="M9 6l6 6-6 6" />
				</svg>
			</Match>
			<Match when={props.name === "chevron-left"}>
				<svg {...common()} aria-hidden="true">
					<path d="M15 6l-6 6 6 6" />
				</svg>
			</Match>
			<Match when={props.name === "star"}>
				<svg {...common()} aria-hidden="true">
					<path d="M12 3l2.6 6 6.4.6-5 4.4 1.6 6.4L12 17l-5.6 3.4L8 14l-5-4.4 6.4-.6z" />
				</svg>
			</Match>
			<Match when={props.name === "bolt"}>
				<svg {...common()} aria-hidden="true">
					<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
				</svg>
			</Match>
			<Match when={props.name === "clock"}>
				<svg {...common()} aria-hidden="true">
					<circle cx="12" cy="12" r="9" />
					<path d="M12 7v5l3 2" />
				</svg>
			</Match>
			<Match when={props.name === "calendar"}>
				<svg {...common()} aria-hidden="true">
					<rect x="3" y="5" width="18" height="16" rx="1" />
					<path d="M3 10h18M8 3v4M16 3v4" />
				</svg>
			</Match>
			<Match when={props.name === "tag"}>
				<svg {...common()} aria-hidden="true">
					<path d="M3 12l9-9 9 9-9 9z" />
					<circle cx="9" cy="9" r="1.5" />
				</svg>
			</Match>
			<Match when={props.name === "send"}>
				<svg {...common()} aria-hidden="true">
					<path d="M3 11l18-7-7 18-3-7z" />
				</svg>
			</Match>
			<Match when={props.name === "user"}>
				<svg {...common()} aria-hidden="true">
					<circle cx="12" cy="8" r="4" />
					<path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
				</svg>
			</Match>
			<Match when={props.name === "google"}>
				<svg {...common()} aria-hidden="true">
					<circle cx="12" cy="12" r="9" />
					<path d="M12 8v4h5a5 5 0 11-1.5-3.5" />
				</svg>
			</Match>
			<Match when={props.name === "outlook"}>
				<svg {...common()} aria-hidden="true">
					<rect x="3" y="5" width="13" height="14" rx="1" />
					<path d="M16 8h5v8h-5M7 9v6M7 9l5 3-5 3" />
				</svg>
			</Match>
			<Match when={props.name === "plus"}>
				<svg {...common()} aria-hidden="true">
					<path d="M12 4v16M4 12h16" />
				</svg>
			</Match>
			<Match when={props.name === "menu"}>
				<svg {...common()} aria-hidden="true">
					<path d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</Match>
			<Match when={props.name === "dot"}>
				<svg {...common()} aria-hidden="true">
					<circle cx="12" cy="12" r="3" fill={props.color} />
				</svg>
			</Match>
			<Match when={props.name === "sparkle"}>
				<svg {...common()} aria-hidden="true">
					<path d="M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5z" />
				</svg>
			</Match>
			<Match when={props.name === "shield"}>
				<svg {...common()} aria-hidden="true">
					<path d="M12 3l8 3v6c0 4.5-3.5 8.5-8 9-4.5-.5-8-4.5-8-9V6z" />
				</svg>
			</Match>
			<Match when={props.name === "hide"}>
				<svg {...common()} aria-hidden="true">
					<path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z" />
					<path d="M3 3l18 18" />
				</svg>
			</Match>
			<Match when={props.name === "back"}>
				<svg {...common()} aria-hidden="true">
					<path d="M21 12H4M11 5l-7 7 7 7" />
				</svg>
			</Match>
			<Match when={props.name === "attach"}>
				<svg {...common()} aria-hidden="true">
					<path d="M21 11l-9 9a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 11-3-3l7-7" />
				</svg>
			</Match>
		</Switch>
	);
};

export { AtlasIcon };
