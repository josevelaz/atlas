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

/* ================================================================== */
/*  App shell / nav / mail-list surfaces                              */
/*                                                                    */
/*  Layout, navigation, and mail-list styling migrated out of the     */
/*  hand-written `.atlas-app` / `.atlas-topbar` / `.atlas-sidebar` /  */
/*  `.atlas-nav-*` / `.atlas-list*` / `.atlas-mail-row` CSS into       */
/*  Tailwind utility strings over the same design tokens. The desktop  */
/*  three-column grid and the responsive mobile/tablet stack are       */
/*  expressed with arbitrary `max-[…]` variants matching the prior     */
/*  1100px / 860px breakpoints.                                        */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/*  App shell grid                                                     */
/* ------------------------------------------------------------------ */

/**
 * The fixed three-column desktop grid (sidebar 240 · list 380 · pane 1fr)
 * with a full-width 56px top-bar row. Collapses to narrower columns at
 * ≤1100px and to a single scrollable column stack at ≤860px so no region
 * is clipped off-canvas.
 */
export const appShellClasses =
	"grid grid-rows-[56px_1fr] grid-cols-[240px_380px_1fr] h-[100dvh] w-full " +
	"bg-background overflow-hidden " +
	"max-[1100px]:grid-cols-[200px_320px_1fr] " +
	"max-[860px]:grid-cols-[minmax(0,1fr)] max-[860px]:grid-rows-[56px_auto_auto_auto] " +
	"max-[860px]:h-auto max-[860px]:min-h-[100dvh] max-[860px]:overflow-x-hidden";

/* ------------------------------------------------------------------ */
/*  Top bar                                                            */
/* ------------------------------------------------------------------ */

export const topBarClasses =
	"col-[1/-1] flex items-center gap-3 px-4 z-[2] bg-background " +
	"border-b-[3px] border-solid border-border";

/** VT323 version chip next to the logo. */
export const topBarVersionClasses =
	"font-[family-name:var(--font-mono)] text-[11px] text-muted ml-1 whitespace-nowrap";

/** Thin vertical ink divider in the top bar. */
export const dividerVClasses = "w-px h-6 bg-border";

/** Flex spacer that pushes trailing controls to the right. */
export const spacerClasses = "flex-1";

/* ------------------------------------------------------------------ */
/*  Structural columns                                                 */
/* ------------------------------------------------------------------ */

/** Shared column chrome (sidebar / list / pane): ink right rule + flex col. */
const COLUMN_BASE =
	"flex flex-col min-h-0 overflow-hidden border-r-[length:var(--border-w)] border-solid border-border " +
	"max-[860px]:col-[1] max-[860px]:border-r-0 max-[860px]:overflow-visible " +
	"max-[860px]:border-b-[length:var(--border-w)]";

/**
 * Sidebar column: dotted radial background, 12px padding, 4px gap. On mobile
 * it wraps into a horizontal pill row instead of a vertical stack.
 */
export const sidebarClasses =
	`${COLUMN_BASE} bg-background p-3 gap-1 ` +
	"bg-[radial-gradient(circle,rgba(128,128,128,0.06)_1px,transparent_1px)] bg-[length:18px_18px] " +
	"max-[860px]:flex-row max-[860px]:flex-wrap max-[860px]:items-center max-[860px]:gap-1.5";

/** Mail-list column wrapper. */
export const listColumnClasses = `${COLUMN_BASE} bg-background`;

/**
 * Wide list span (Screener): stretches across the list+pane columns and drops
 * its right rule. On mobile it collapses to the single stacked column.
 */
export const listWideClasses =
	`${listColumnClasses} col-[2/4] border-r-0 ` +
	"max-[860px]:col-[1] max-[860px]:border-b-[length:var(--border-w)] max-[860px]:border-solid max-[860px]:border-border";

/** The thread/right pane column (no right rule, calm canvas). */
export const paneClasses =
	"flex flex-col min-h-0 overflow-hidden bg-background " +
	"max-[860px]:col-[1] max-[860px]:border-r-0 max-[860px]:overflow-visible " +
	"max-[860px]:border-b-[length:var(--border-w)] max-[860px]:border-solid max-[860px]:border-border " +
	"max-[860px]:min-h-[60vh]";

/** Full-width region span (Tasks / Settings). */
export const fullPaneClasses =
	"col-[2/4] flex flex-col min-h-0 overflow-hidden " +
	"max-[860px]:col-[1] max-[860px]:border-b-[length:var(--border-w)] max-[860px]:border-solid max-[860px]:border-border max-[860px]:overflow-visible";

/* ------------------------------------------------------------------ */
/*  Sidebar nav                                                        */
/* ------------------------------------------------------------------ */

/**
 * A sidebar nav row (button or link). Transparent until active; the active
 * row fills yellow, gains an ink border + small colored offset shadow. On
 * mobile rows shrink to content width and drop the flexible label column.
 */
export const navItemClasses =
	"grid grid-cols-[28px_1fr_auto] items-center gap-2 w-full px-2.5 py-2 text-left cursor-pointer " +
	"border-[length:var(--border-w)] border-solid border-transparent rounded-[var(--radius)] " +
	"font-[family-name:var(--font-base)] font-bold text-[13px] text-foreground bg-transparent " +
	"hover:bg-[rgba(29,31,39,0.06)] dark:hover:bg-[rgba(255,255,255,0.08)] " +
	"focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:outline-offset-2 " +
	"max-[860px]:w-auto max-[860px]:grid-cols-[28px_auto_auto]";

/** Active-state add-on for a nav row (yellow fill, ink border, colored shadow). */
export const navItemActiveClasses =
	"bg-main text-main-foreground border-border shadow-[3px_3px_0_0_var(--color-main)]";

/** The 28px coded icon tile inside a nav row. */
export const navTileClasses =
	"inline-flex items-center justify-center w-7 h-7 " +
	"border-[length:var(--border-w)] border-solid border-border rounded-[var(--radius)]";

/** VT323 count pill on a nav row. */
export const navCountClasses =
	"font-[family-name:var(--font-mono)] text-[11px] min-w-[22px] px-[5px] text-center tabular-nums " +
	"bg-secondary-background border-[1.5px] border-solid border-border rounded-[4px]";

/** The active-row count pill swaps to the cream canvas fill. */
export const navCountActiveClasses = "bg-background";

/** Uppercase VT323 section heading ("Mail" / "Assist"). */
export const sectionTitleClasses =
	"font-[family-name:var(--font-mono)] text-[14px] font-extrabold uppercase tracking-[0.12em] " +
	"text-muted px-2.5 pt-3 pb-1 whitespace-nowrap " +
	"max-[860px]:basis-full max-[860px]:px-1 max-[860px]:pt-1 max-[860px]:pb-0";

/* ------------------------------------------------------------------ */
/*  AI usage card                                                      */
/* ------------------------------------------------------------------ */

/** Electric-blue usage meter card pinned to the sidebar bottom. */
export const usageCardClasses =
	"p-2.5 bg-ai text-white shadow-[var(--shadow-sm)] " +
	"border-[length:var(--border-w)] border-solid border-border rounded-[var(--radius)] " +
	"max-[860px]:basis-full";

/** Sparkle + label row. */
export const usageLabelClasses = "flex items-center gap-1.5 mb-1";

/** Uppercase mono label text. */
export const usageLabelTextClasses =
	"text-[10px] font-extrabold uppercase tracking-[0.06em] whitespace-nowrap";

/** Thin translucent progress track. */
export const usageTrackClasses =
	"h-1.5 mt-1 rounded-[2px] overflow-hidden bg-white/30";

/** White progress fill. */
export const usageFillClasses = "h-full bg-white";

/** VT323 "x/100 monthly · tier" readout. */
export const usageMetaClasses =
	"font-[family-name:var(--font-mono)] text-[10px] mt-1 opacity-85 whitespace-nowrap";

/* ------------------------------------------------------------------ */
/*  Mail list header / scroll                                          */
/* ------------------------------------------------------------------ */

/** List header bar: title + count, divided from the rows by an ink rule. */
export const listHeaderClasses =
	"flex items-center justify-between gap-2 px-4 pt-[14px] pb-2.5 " +
	"border-b-[length:var(--border-w)] border-solid border-border";

/** Display-face list title. */
export const listHeaderTitleClasses =
	"font-[family-name:var(--font-display)] text-[18px] uppercase tracking-[0.04em]";

/** VT323 count meta on the list header. */
export const listMetaClasses =
	"font-[family-name:var(--font-mono)] text-[15px] text-muted tabular-nums";

/** Scrollable rows region. */
export const listScrollClasses =
	"flex-1 min-h-0 overflow-y-auto max-[860px]:overflow-visible";

/* ------------------------------------------------------------------ */
/*  Generic flex helpers (former .atlas-row / .atlas-gap-8)            */
/* ------------------------------------------------------------------ */

/** `flex items-center` row. */
export const rowClasses = "flex items-center";

/** 8px gap modifier paired with `rowClasses`. */
export const gap8Classes = "gap-2";

/* ------------------------------------------------------------------ */
/*  Mail row                                                           */
/* ------------------------------------------------------------------ */

/**
 * One mail row: avatar · sender/subject/preview stack · timestamp. Dashed
 * divider between rows (solid ink on the last), hover lifts to the surface
 * fill, selected rows fill yellow. The unread dot is rendered as a `before:`
 * pseudo-element keyed off `data-unread`.
 */
export const mailRowClasses =
	"relative grid grid-cols-[40px_1fr_auto] gap-2.5 w-full px-4 py-3 text-left cursor-pointer " +
	"bg-background text-foreground font-[family-name:var(--font-base)] " +
	"border-b-[length:var(--border-w)] border-dashed border-[rgba(128,128,128,0.3)] " +
	"last:border-b-solid last:border-b-border " +
	"hover:bg-secondary-background " +
	"focus-visible:outline-2 focus-visible:outline-[var(--color-ring)] focus-visible:[outline-offset:-2px] " +
	// Unread dot (data-unread): small yellow ink-bordered dot at the left edge.
	"data-[unread=true]:before:content-[''] data-[unread=true]:before:absolute data-[unread=true]:before:left-1.5 " +
	"data-[unread=true]:before:top-1/2 data-[unread=true]:before:-translate-y-1/2 " +
	"data-[unread=true]:before:w-1.5 data-[unread=true]:before:h-1.5 data-[unread=true]:before:rounded-full " +
	"data-[unread=true]:before:bg-main data-[unread=true]:before:border-[1.5px] data-[unread=true]:before:border-solid data-[unread=true]:before:border-border " +
	// Selected fill (data-selected): yellow surface, ink dot swaps to ink.
	"data-[selected=true]:bg-main data-[selected=true]:text-main-foreground " +
	"data-[selected=true]:data-[unread=true]:before:bg-foreground";

/** Sender line. Bolder when the row is unread. */
export const mailFromClasses =
	"font-bold text-[13px] group-data-[unread=true]:font-extrabold";

/** Subject line (single-line ellipsis). */
export const mailSubjClasses =
	"text-[13px] font-bold mt-px overflow-hidden text-ellipsis whitespace-nowrap";

/** Two-line preview clamp; dims on selected rows. */
export const mailPreviewClasses =
	"text-[12px] text-muted mt-0.5 leading-[1.35] overflow-hidden " +
	"[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [line-clamp:2] " +
	"group-data-[selected=true]:text-[rgba(29,31,39,0.7)]";

/** Right-aligned VT323 timestamp; dims on selected rows. */
export const mailMetaTextClasses =
	"font-[family-name:var(--font-mono)] text-[11px] text-muted text-right whitespace-nowrap " +
	"group-data-[selected=true]:text-[rgba(29,31,39,0.7)]";

/** Tag chip row under the sender stack. */
export const rowTagsClasses = "flex flex-wrap gap-1 mt-1.5";

/* ------------------------------------------------------------------ */
/*  Tag chip                                                           */
/* ------------------------------------------------------------------ */

/**
 * Standalone tag chip (former `.atlas-tag`). Uppercase mono caps, 1.5px ink
 * border, 3px radius. Used on mail rows, the thread header, and the dev
 * design-system gallery — no single SolidJS component owns it. The base styling
 * is framework-neutral; the in-app retro upgrade (VT323 + sticker tilt) lives in
 * `tagAppClasses`.
 */
export const tagClasses =
	"inline-flex items-center gap-1 px-1.5 py-px leading-none whitespace-nowrap uppercase tracking-[0.04em] " +
	"font-[family-name:var(--font-base)] text-[13px] font-bold " +
	"bg-secondary-background text-foreground border-[1.5px] border-solid border-border rounded-[3px]";

/**
 * App-shell retro upgrade for the tag chip (former `.atlas-app .atlas-tag`
 * pass). Swaps the mono face for VT323 at 15px and adds the default sticker
 * tilt. Compose with `tagClasses` for chips that render inside the application
 * shell (the thread header and single chips).
 */
export const tagAppClasses =
	"font-[family-name:'VT323',var(--font-base)] text-[15px] rotate-[0.8deg]";

/**
 * Row variant of the retro tag upgrade (former `.atlas-row-tags .atlas-tag`
 * pass). Same VT323 face, but every second chip in the row tilts the other way
 * for a scattered-sticker look. Used by the mail-row tag loop.
 */
export const tagAppRowClasses =
	"font-[family-name:'VT323',var(--font-base)] text-[15px] rotate-[0.8deg] " +
	"[&:nth-child(2n)]:-rotate-[1deg]";

/* ------------------------------------------------------------------ */
/*  AI inbox banner                                                    */
/* ------------------------------------------------------------------ */

/** Electric-blue banner under the inbox list header. */
export const aiBannerClasses =
	"flex items-center gap-2 px-4 py-2 bg-ai text-white text-[12px] font-bold " +
	"border-b-[length:var(--border-w)] border-solid border-border";

/**
 * Override for the small Button embedded in the AI banner: flat (no offset
 * shadow), hairline border, compact 22px height — matching the prior
 * `.atlas-ai-banner .atlas-btn.is-sm` descendant rule.
 */
export const aiBannerButtonClasses =
	"h-[22px] px-2 text-[11px] border-[1.5px] shadow-none hover:shadow-none active:translate-x-0 active:translate-y-0";

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

/** Centered empty-state panel. */
export const emptyClasses =
	"flex flex-col items-center justify-center h-full gap-[14px] p-10 text-center";

/** Yellow icon box with a large hard offset shadow (rotated -3deg sticker). */
export const emptyBoxClasses =
	"flex items-center justify-center w-20 h-20 mb-1.5 -rotate-3 bg-main " +
	"border-[length:var(--border-w)] border-solid border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]";

/** Empty-state heading (Bungee, non-uppercase). */
export const emptyHeadingClasses =
	"font-[family-name:var(--font-display)] text-[22px] normal-case tracking-[-0.01em]";

/** Muted body copy under the heading. */
export const emptyBodyClasses = "text-muted max-w-[320px] leading-[1.5]";
