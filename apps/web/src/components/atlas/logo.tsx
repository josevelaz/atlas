// Atlas brandmark — compass star + ATLAS wordmark.
// SolidJS port of `docs/prototype/icons.jsx` (CompassMark + Logo).
//
// Self-contained: composes Atlas design tokens (`--color-main`,
// `--color-border`, `--color-foreground`, `--radius`, `--shadow-sm`,
// `--font-display`) via inline styles so it does not depend on prototype-only
// `.logo*` CSS classes. No runtime imports from `docs/prototype/**`.

import type { Component } from "solid-js";
import { mergeProps } from "solid-js";

export interface CompassMarkProps {
	size?: number;
	/** Stroke width of the needle outlines. */
	sw?: number;
}

/**
 * The compass-star brandmark: a solid vertical needle + an outline horizontal
 * needle, both keyed to the ink border color, set on a yellow accent chip.
 */
const CompassMark: Component<CompassMarkProps> = (raw_props) => {
	const props = mergeProps({ size: 30, sw: 2.4 }, raw_props);

	const p = () => props.size;
	const c = () => props.size / 2;
	const o = () => props.size * 0.3;
	const i = () => props.size * 0.11;

	const vNeedle = () =>
		`${c()},${c() - o()} ${c() + i()},${c()} ${c()},${c() + o()} ${c() - i()},${c()}`;
	const hNeedle = () =>
		`${c() - o()},${c()} ${c()},${c() - i()} ${c() + o()},${c()} ${c()},${c() + i()}`;
	const pad = () => Math.round(props.size * 0.18);

	return (
		<span
			style={{
				display: "inline-flex",
				"align-items": "center",
				"justify-content": "center",
				flex: "none",
				background: "var(--color-main)",
				border: "var(--border-w) solid var(--color-border)",
				"border-radius": "var(--radius)",
				"box-shadow": "var(--shadow-sm)",
				width: `${props.size + pad() * 2}px`,
				height: `${props.size + pad() * 2}px`,
			}}
		>
			<svg
				width={props.size}
				height={props.size}
				viewBox={`0 0 ${p()} ${p()}`}
				style={{ display: "block" }}
				aria-hidden="true"
			>
				<polygon
					points={hNeedle()}
					fill="none"
					stroke="var(--color-border)"
					stroke-width={props.sw}
					stroke-linejoin="round"
				/>
				<polygon
					points={vNeedle()}
					fill="var(--color-border)"
					stroke="var(--color-border)"
					stroke-width={props.sw}
					stroke-linejoin="round"
				/>
			</svg>
		</span>
	);
};

export interface LogoProps {
	/** Size of the compass chip glyph. */
	markSize?: number;
	/** Optional override for the ATLAS wordmark font size (px). */
	wordSize?: number;
}

/** Full lockup: compass chip + ATLAS wordmark with accent-colored dot. */
const Logo: Component<LogoProps> = (raw_props) => {
	const props = mergeProps({ markSize: 26 }, raw_props);

	return (
		<div
			style={{
				display: "inline-flex",
				"align-items": "center",
				gap: "9px",
				"font-family": "var(--font-display)",
				cursor: "default",
				"user-select": "none",
			}}
			role="img"
			aria-label="Atlas"
		>
			<CompassMark size={props.markSize} />
			<span
				style={{
					"font-family": "var(--font-display)",
					"font-weight": 400,
					"font-size": props.wordSize ? `${props.wordSize}px` : "18px",
					"letter-spacing": "0.01em",
					"line-height": 1,
					"text-transform": "uppercase",
					color: "var(--color-foreground)",
				}}
			>
				ATLAS
				<span
					style={{
						color: "var(--color-main)",
						"-webkit-text-stroke": "1.5px var(--color-border)",
					}}
				>
					.
				</span>
			</span>
		</div>
	);
};

export { CompassMark, Logo };
