// Atlas — UI primitive class maps.
//
// Tailwind-first replacement for the hand-written `.atlas-*` primitive CSS that
// used to live in `styles.css`. Each export is a CVA factory (or a plain class
// string) that resolves the design-system tokens declared in `styles.css`'s
// `@theme`/`:root` blocks through Tailwind arbitrary values:
//   bg-secondary-background, border-border, shadow-[var(--shadow)],
//   rounded-[var(--radius)], etc.
//
// Components compose these strings via `cn(...)`. The legacy `.atlas-*` marker
// classes are still emitted by the components as *selector hooks* for the
// app-shell / overlay CSS that styles primitives in context (e.g. the
// `.atlas-app .atlas-btn.is-primary::after` star tick, the borderless
// `.atlas-compose-field .atlas-input` override). Those marker classes no longer
// carry any styling of their own — the styling lives entirely in the utilities
// below.

import { cva } from "class-variance-authority";

/* ------------------------------------------------------------------ */
/*  Button                                                             */
/* ------------------------------------------------------------------ */

/**
 * Hard offset shadow that grows by 1px on hover and collapses on press —
 * the kinetic "press-into-shadow" feel from DESIGN.md, expressed as Tailwind
 * arbitrary values over the shadow tokens.
 */
const BUTTON_KINETIC =
	"shadow-[var(--shadow)] transition-[transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-base)] " +
	"hover:translate-x-[-1px] hover:translate-y-[-1px] " +
	"hover:shadow-[calc(var(--shadow-x)+1px)_calc(var(--shadow-y)+1px)_0_0_var(--color-border)] " +
	"active:translate-x-[var(--shadow-x)] active:translate-y-[var(--shadow-y)] active:shadow-none " +
	"focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-2";

export const buttonClasses = cva(
	"inline-flex items-center justify-center gap-[6px] whitespace-nowrap select-none cursor-pointer " +
		"border-[length:var(--border-w)] border-solid border-border rounded-[var(--radius)] " +
		"font-[family-name:var(--font-base)] font-bold tracking-[0.02em] " +
		BUTTON_KINETIC,
	{
		variants: {
			variant: {
				default: "bg-secondary-background text-foreground",
				primary: "bg-main text-main-foreground",
				danger: "bg-danger text-[#1d1f27]",
				ghost:
					"bg-transparent border-transparent shadow-none " +
					"hover:bg-[rgba(29,31,39,0.06)] hover:translate-x-0 hover:translate-y-0 hover:shadow-none " +
					"active:translate-x-0 active:translate-y-0 active:shadow-none " +
					"dark:hover:bg-[rgba(255,255,255,0.08)]",
			},
			size: {
				default: "h-9 px-[14px] text-[13px]",
				sm:
					"h-7 px-[10px] text-[12px] shadow-[var(--shadow-sm)] " +
					"hover:shadow-[3px_3px_0_0_var(--color-border)] " +
					"active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
			},
			icon: {
				true: "px-0",
				false: "",
			},
			disabled: {
				true: "opacity-50 cursor-not-allowed pointer-events-none",
				false: "",
			},
		},
		compoundVariants: [
			// Icon buttons are square: width tracks the height of each size.
			{ icon: true, size: "default", class: "w-9" },
			{ icon: true, size: "sm", class: "w-7" },
		],
		defaultVariants: {
			variant: "default",
			size: "default",
			icon: false,
			disabled: false,
		},
	},
);

/* ------------------------------------------------------------------ */
/*  Card / surface                                                     */
/* ------------------------------------------------------------------ */

export const cardClasses = cva(
	"bg-secondary-background border-[length:var(--border-w)] border-solid border-border",
	{
		variants: {
			size: {
				default: "rounded-[var(--radius)] shadow-[var(--shadow)]",
				lg: "rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]",
			},
		},
		defaultVariants: { size: "default" },
	},
);

/* ------------------------------------------------------------------ */
/*  Badge                                                              */
/* ------------------------------------------------------------------ */

export const badgeClasses = cva(
	"inline-flex items-center justify-center gap-1 h-[22px] px-2 whitespace-nowrap " +
		"border-[length:var(--border-w)] border-solid border-border " +
		"font-[family-name:var(--font-base)] font-bold text-[11px] tracking-[0.02em]",
	{
		variants: {
			variant: {
				default: "bg-secondary-background text-foreground",
				main: "bg-main text-main-foreground",
				feed: "bg-feed text-[#1d1f27]",
				paper: "bg-paper text-[#1d1f27]",
				ai: "bg-ai text-white",
				danger: "bg-danger text-[#1d1f27]",
				inbox: "bg-inbox text-[#1d1f27]",
				muted: "bg-transparent text-muted",
			},
			square: {
				true: "rounded-[var(--radius)]",
				false: "rounded-full",
			},
		},
		defaultVariants: { variant: "default", square: false },
	},
);

/* ------------------------------------------------------------------ */
/*  Priority chip                                                      */
/* ------------------------------------------------------------------ */

export const priorityClasses = cva(
	"inline-flex items-center gap-1 leading-none uppercase tracking-[0.04em] " +
		"font-[family-name:var(--font-mono)] font-bold text-[13px] px-[6px] py-[1px] " +
		"border-[1.5px] border-solid border-border rounded-[3px]",
	{
		variants: {
			priority: {
				P1: "bg-danger text-[#1d1f27]",
				P2: "bg-feed text-[#1d1f27]",
				P3: "bg-secondary-background text-foreground",
			},
		},
	},
);

/* ------------------------------------------------------------------ */
/*  Input / textarea                                                   */
/* ------------------------------------------------------------------ */

const FIELD_BASE =
	"w-full px-[10px] py-2 outline-none " +
	"border-[length:var(--border-w)] border-solid border-border rounded-[var(--radius)] " +
	"bg-secondary-background text-foreground font-[family-name:var(--font-base)] font-normal " +
	"placeholder:text-muted-2 " +
	"transition-[transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-base)] " +
	"focus:shadow-[var(--shadow)] focus:translate-x-[-2px] focus:translate-y-[-2px]";

/** Standalone text input. */
export const inputClasses = FIELD_BASE;

/** Multiline textarea — same field treatment plus vertical resize + min height. */
export const textareaClasses = `${FIELD_BASE} resize-y min-h-[120px]`;

/* ------------------------------------------------------------------ */
/*  Kbd                                                                */
/* ------------------------------------------------------------------ */

export const kbdClasses =
	"inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] leading-none " +
	"border-[1.5px] border-solid border-border rounded-[4px] " +
	"bg-background text-foreground font-[family-name:var(--font-mono)] font-bold text-[14px] " +
	"shadow-[1.5px_1.5px_0_0_var(--color-border)]";

/* ------------------------------------------------------------------ */
/*  Avatar                                                             */
/* ------------------------------------------------------------------ */

export const avatarClasses = cva(
	"inline-flex items-center justify-center shrink-0 select-none " +
		"border-[length:var(--border-w)] border-solid border-border rounded-[var(--radius)] " +
		"font-[family-name:var(--font-base)] font-bold",
	{
		variants: {
			size: {
				sm: "w-7 h-7 text-[11px]",
				default: "w-9 h-9 text-[13px]",
				lg: "w-12 h-12 text-[16px]",
			},
		},
		defaultVariants: { size: "default" },
	},
);

/* ------------------------------------------------------------------ */
/*  Toggle                                                             */
/* ------------------------------------------------------------------ */

export const toggleClasses =
	"group relative inline-flex items-center w-[52px] h-7 p-[2px] cursor-pointer " +
	"border-[length:var(--border-w)] border-solid border-border rounded-[var(--radius)] " +
	"bg-secondary-background shadow-[var(--shadow-sm)] " +
	"transition-colors duration-[var(--duration-base)] ease-[var(--ease-base)] " +
	"data-[on=true]:bg-main";

// The resting `left` is driven by the parent button's `data-on` so the thumb
// renders in the correct position server-side and under reduced motion (these
// values match solid-motionone's `animate` left, so there is no hydration jump).
export const toggleThumbClasses =
	"absolute top-[2px] w-5 h-5 rounded-[3px] bg-foreground " +
	"left-[2px] group-data-[on=true]:left-[28px]";

/* ------------------------------------------------------------------ */
/*  Dialog / overlay                                                   */
/* ------------------------------------------------------------------ */

export const overlayClasses =
	"fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[var(--overlay)]";

export const overlayCardClasses =
	"w-full max-w-[720px] max-h-[90vh] flex flex-col overflow-hidden " +
	"bg-background border-[length:var(--border-w)] border-solid border-border " +
	"rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]";

export const overlayHeadClasses =
	"flex items-center justify-between px-[18px] py-[14px] " +
	"border-b-[length:var(--border-w)] border-solid border-border";

export const overlayBodyClasses = "px-[18px] py-[18px] overflow-y-auto";
