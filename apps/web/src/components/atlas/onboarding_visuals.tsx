// Atlas — onboarding step visuals.
//
// The five declarative visual panels rendered inside the onboarding card body,
// one per `OnboardingVisual` variant from `lib/atlas/types`. Ported verbatim
// from `docs/prototype/onboarding.jsx` (ConnectCard / screener card / CatRow /
// AI summary / empty-inbox), recreated as SolidJS with Atlas tokens. No runtime
// imports from `docs/prototype/**`.

import type { Component } from "solid-js";
import { For, Match, Show, Switch } from "solid-js";

import {
	badgeClasses,
	buttonClasses,
	onbAiBodyClasses,
	onbAiClasses,
	onbAiExtractedClasses,
	onbAiHeadClasses,
	onbCatClasses,
	onbCatDescClasses,
	onbCatNameClasses,
	onbCatsClasses,
	onbCatTileClasses,
	onbComingSoonClasses,
	onbConnectBtnClasses,
	onbConnectClasses,
	onbConnectGatedClasses,
	onbConnectGridClasses,
	onbConnectHeadClasses,
	onbConnectNameClasses,
	onbConnectSubClasses,
	onbConnectTextClasses,
	onbConnectTileClasses,
	onbEmptyBodyClasses,
	onbEmptyBoxClasses,
	onbEmptyClasses,
	onbEmptyHeadingClasses,
	onbExtractClasses,
	onbExtractDotClasses,
	onbExtractDueClasses,
	onbExtractLabelClasses,
	onbScreenerAcceptClasses,
	onbScreenerActionsClasses,
	onbScreenerAddrClasses,
	onbScreenerAvatarClasses,
	onbScreenerBodyClasses,
	onbScreenerClasses,
	onbScreenerHeadClasses,
	onbScreenerNameClasses,
	onbScreenerPreviewClasses,
	onbScreenerRejectClasses,
	onbScreenerSubjectClasses,
	onbWelcomeBoxClasses,
	onbWelcomeClasses,
} from "../../lib/atlas/component_classes";
import type {
	OnboardingCategoryRow,
	OnboardingExtractedRow,
	OnboardingScreenerCard,
	OnboardingVisual,
} from "../../lib/atlas/types";
import { getAuthClient } from "../../lib/auth";
import { cn } from "../../lib/utils";
import { AtlasIcon } from "./atlas_icon";
import { Logo } from "./logo";

// ---------------------------------------------------------------------------
// Step 1 — connect provider cards
// ---------------------------------------------------------------------------

interface ConnectCardProps {
	provider: "Google" | "Microsoft";
	sub: string;
	/** When set, the card is a non-interactive gate (e.g. "Coming soon"). */
	comingSoon?: boolean;
}

function ConnectCard(props: ConnectCardProps) {
	const tile = () =>
		props.provider === "Google" ? "var(--color-main)" : "var(--color-ai)";
	const icon = () => (props.provider === "Google" ? "google" : "outlook");

	// Google starts the OAuth consent flow with `/inbox` as the post-auth
	// callback. Microsoft is an explicit, visible "Coming soon" gate — rendered
	// disabled with no click handler so it can't be used to bypass consent.
	const handleConnect = () => {
		const callbackURL = new URL("/inbox", window.location.origin).toString();
		getAuthClient().signIn.social({
			provider: "google",
			callbackURL,
		});
	};

	return (
		<div
			class={cn(onbConnectClasses, props.comingSoon && onbConnectGatedClasses)}
			aria-disabled={props.comingSoon ? "true" : undefined}
		>
			<div class={onbConnectHeadClasses}>
				<span class={onbConnectTileClasses} style={{ background: tile() }}>
					<AtlasIcon name={icon()} size={20} color="#fff" stroke={2.5} />
				</span>
				<div class={onbConnectTextClasses}>
					<div class={onbConnectNameClasses}>Connect {props.provider}</div>
					<div class={onbConnectSubClasses}>{props.sub}</div>
				</div>
			</div>
			<Show
				when={props.comingSoon}
				fallback={
					<button
						type="button"
						class={cn(
							buttonClasses({ variant: "primary", size: "sm" }),
							onbConnectBtnClasses,
						)}
						onClick={handleConnect}
					>
						Connect with Google
					</button>
				}
			>
				<span
					class={cn(badgeClasses({ variant: "muted" }), onbComingSoonClasses)}
				>
					Coming soon
				</span>
			</Show>
		</div>
	);
}

function ConnectVisual() {
	return (
		<div class={onbConnectGridClasses}>
			<ConnectCard provider="Google" sub="Gmail · Google Workspace" />
			<ConnectCard
				provider="Microsoft"
				sub="Outlook · Microsoft 365"
				comingSoon
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 0 — welcome
// ---------------------------------------------------------------------------

function WelcomeVisual() {
	return (
		<div class={onbWelcomeClasses}>
			<div class={onbWelcomeBoxClasses}>
				<Logo markSize={40} />
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 2 — screener card
// ---------------------------------------------------------------------------

function ScreenerCardVisual(props: { card: OnboardingScreenerCard }) {
	return (
		<div class={onbScreenerClasses}>
			<div class={onbScreenerHeadClasses}>
				<div class={onbScreenerAvatarClasses}>{props.card.initials}</div>
				<div>
					<div class={onbScreenerNameClasses}>{props.card.name}</div>
					<div class={onbScreenerAddrClasses}>{props.card.addr}</div>
				</div>
			</div>
			<div class={onbScreenerBodyClasses}>
				<div class={onbScreenerSubjectClasses}>{props.card.subject}</div>
				<div class={onbScreenerPreviewClasses}>{props.card.preview}</div>
			</div>
			<div class={onbScreenerActionsClasses}>
				<div class={onbScreenerAcceptClasses}>ACCEPT</div>
				<div class={onbScreenerRejectClasses}>REJECT</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 3 — category rows
// ---------------------------------------------------------------------------

function CatRow(props: { row: OnboardingCategoryRow }) {
	return (
		<div class={onbCatClasses}>
			<span class={onbCatTileClasses} style={{ background: props.row.color }}>
				<AtlasIcon name={props.row.icon} size={22} stroke={2.5} />
			</span>
			<div>
				<div class={onbCatNameClasses}>{props.row.name}</div>
				<div class={onbCatDescClasses}>{props.row.desc}</div>
			</div>
		</div>
	);
}

function CategoriesVisual(props: { rows: OnboardingCategoryRow[] }) {
	return (
		<div class={onbCatsClasses}>
			<For each={props.rows}>{(row) => <CatRow row={row} />}</For>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 4 — AI summary
// ---------------------------------------------------------------------------

function ExtractedRow(props: { row: OnboardingExtractedRow }) {
	return (
		<div class={onbExtractClasses}>
			<span
				class={onbExtractDotClasses}
				style={{ background: props.row.color }}
			/>
			<span class={onbExtractLabelClasses}>{props.row.label}</span>
			<span class={onbExtractDueClasses}>{props.row.due}</span>
		</div>
	);
}

function AiSummaryVisual(props: {
	summary: string;
	extracted: OnboardingExtractedRow[];
}) {
	return (
		<div class={onbAiClasses}>
			<div class={onbAiHeadClasses}>
				<AtlasIcon name="sparkle" size={14} color="#fff" stroke={2.5} /> AI
				summary
			</div>
			<div class={onbAiBodyClasses}>{props.summary}</div>
			<div class={onbAiExtractedClasses}>
				<For each={props.extracted}>{(row) => <ExtractedRow row={row} />}</For>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 5 — empty inbox
// ---------------------------------------------------------------------------

function EmptyInboxVisual(props: { heading: string; body: string }) {
	return (
		<div class={onbEmptyClasses}>
			<div class={onbEmptyBoxClasses}>
				<AtlasIcon name="inbox" size={30} stroke={2.5} />
			</div>
			<h3 class={onbEmptyHeadingClasses}>{props.heading}</h3>
			<p class={onbEmptyBodyClasses}>{props.body}</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Switch
// ---------------------------------------------------------------------------

export interface OnboardingVisualProps {
	visual: OnboardingVisual;
}

const OnboardingVisualPanel: Component<OnboardingVisualProps> = (props) => {
	return (
		<Switch>
			<Match when={props.visual.kind === "welcome"}>
				<WelcomeVisual />
			</Match>
			<Match when={props.visual.kind === "connect"}>
				<ConnectVisual />
			</Match>
			<Match
				when={props.visual.kind === "screener-card" ? props.visual : undefined}
			>
				{(v) => <ScreenerCardVisual card={v().card} />}
			</Match>
			<Match
				when={props.visual.kind === "categories" ? props.visual : undefined}
			>
				{(v) => <CategoriesVisual rows={v().rows} />}
			</Match>
			<Match
				when={props.visual.kind === "ai-summary" ? props.visual : undefined}
			>
				{(v) => (
					<AiSummaryVisual summary={v().summary} extracted={v().extracted} />
				)}
			</Match>
			<Match
				when={props.visual.kind === "empty-inbox" ? props.visual : undefined}
			>
				{(v) => <EmptyInboxVisual heading={v().heading} body={v().body} />}
			</Match>
		</Switch>
	);
};

export { OnboardingVisualPanel };
