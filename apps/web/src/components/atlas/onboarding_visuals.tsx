// Atlas — onboarding step visuals.
//
// The five declarative visual panels rendered inside the onboarding card body,
// one per `OnboardingVisual` variant from `lib/atlas/types`. Ported verbatim
// from `docs/prototype/onboarding.jsx` (ConnectCard / screener card / CatRow /
// AI summary / empty-inbox), recreated as SolidJS with Atlas tokens. No runtime
// imports from `docs/prototype/**`.

import type { Component } from "solid-js";
import { For, Match, Switch } from "solid-js";
import type {
	OnboardingCategoryRow,
	OnboardingExtractedRow,
	OnboardingScreenerCard,
	OnboardingVisual,
} from "../../lib/atlas/types";
import { AtlasIcon } from "./atlas_icon";

// ---------------------------------------------------------------------------
// Step 1 — connect provider cards
// ---------------------------------------------------------------------------

interface ConnectCardProps {
	provider: "Google" | "Microsoft";
	sub: string;
}

function ConnectCard(props: ConnectCardProps) {
	const tile = () =>
		props.provider === "Google" ? "var(--color-main)" : "var(--color-ai)";
	const icon = () => (props.provider === "Google" ? "google" : "outlook");
	return (
		<div class="atlas-onb-connect">
			<div class="atlas-onb-connect-head">
				<span class="atlas-onb-connect-tile" style={{ background: tile() }}>
					<AtlasIcon name={icon()} size={20} color="#fff" stroke={2.5} />
				</span>
				<div class="atlas-onb-connect-text">
					<div class="atlas-onb-connect-name">Connect {props.provider}</div>
					<div class="atlas-onb-connect-sub">{props.sub}</div>
				</div>
			</div>
			<button
				type="button"
				class="atlas-btn is-primary is-sm atlas-onb-connect-btn"
			>
				Connect with OAuth
			</button>
		</div>
	);
}

function ConnectVisual() {
	return (
		<div class="atlas-onb-connect-grid">
			<ConnectCard provider="Google" sub="Gmail · Google Workspace" />
			<ConnectCard provider="Microsoft" sub="Outlook · Microsoft 365" />
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 2 — screener card
// ---------------------------------------------------------------------------

function ScreenerCardVisual(props: { card: OnboardingScreenerCard }) {
	return (
		<div class="atlas-onb-screener">
			<div class="atlas-onb-screener-head">
				<div class="atlas-onb-screener-avatar">{props.card.initials}</div>
				<div>
					<div class="atlas-onb-screener-name">{props.card.name}</div>
					<div class="atlas-onb-screener-addr">{props.card.addr}</div>
				</div>
			</div>
			<div class="atlas-onb-screener-body">
				<div class="atlas-onb-screener-subject">{props.card.subject}</div>
				<div class="atlas-onb-screener-preview">{props.card.preview}</div>
			</div>
			<div class="atlas-onb-screener-actions">
				<div class="atlas-onb-screener-accept">ACCEPT</div>
				<div class="atlas-onb-screener-reject">REJECT</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 3 — category rows
// ---------------------------------------------------------------------------

function CatRow(props: { row: OnboardingCategoryRow }) {
	return (
		<div class="atlas-onb-cat">
			<span class="atlas-onb-cat-tile" style={{ background: props.row.color }}>
				<AtlasIcon name={props.row.icon} size={22} stroke={2.5} />
			</span>
			<div>
				<div class="atlas-onb-cat-name">{props.row.name}</div>
				<div class="atlas-onb-cat-desc">{props.row.desc}</div>
			</div>
		</div>
	);
}

function CategoriesVisual(props: { rows: OnboardingCategoryRow[] }) {
	return (
		<div class="atlas-onb-cats">
			<For each={props.rows}>{(row) => <CatRow row={row} />}</For>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 4 — AI summary
// ---------------------------------------------------------------------------

function ExtractedRow(props: { row: OnboardingExtractedRow }) {
	return (
		<div class="atlas-onb-extract">
			<span
				class="atlas-onb-extract-dot"
				style={{ background: props.row.color }}
			/>
			<span class="atlas-onb-extract-label">{props.row.label}</span>
			<span class="atlas-onb-extract-due">{props.row.due}</span>
		</div>
	);
}

function AiSummaryVisual(props: {
	summary: string;
	extracted: OnboardingExtractedRow[];
}) {
	return (
		<div class="atlas-onb-ai">
			<div class="atlas-onb-ai-head">
				<AtlasIcon name="sparkle" size={14} color="#fff" stroke={2.5} /> AI
				summary
			</div>
			<div class="atlas-onb-ai-body">{props.summary}</div>
			<div class="atlas-onb-ai-extracted">
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
		<div class="atlas-onb-empty">
			<div class="atlas-onb-empty-box">
				<AtlasIcon name="inbox" size={30} stroke={2.5} />
			</div>
			<h3 class="atlas-onb-empty-heading">{props.heading}</h3>
			<p class="atlas-onb-empty-body">{props.body}</p>
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
