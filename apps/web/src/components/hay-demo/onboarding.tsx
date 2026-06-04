import {
	ChevronLeft,
	ChevronRight,
	Inbox,
	Mail,
	Newspaper,
	Receipt,
	Sparkles,
} from "lucide-solid";
import type { Component, JSX } from "solid-js";
import { createSignal, For } from "solid-js";

/**
 * Onboarding — multi-step first-run walkthrough for the /dev/hay-inbox demo.
 *
 * Faithfully recreates the prototype's onboarding flow
 * (docs/prototype/hay-inbox-prototype.html → ONB_STEPS / Onboarding):
 *   - Header: HAY. logo chip + "Get started — N/M" mono label on the left,
 *     Skip on the right.
 *   - Body: large display title, a muted sub paragraph, and a per-step visual
 *     recreating the prototype's connect cards, Screener card, category rows,
 *     AI-summary card, and empty-inbox state.
 *   - Footer: Back (left) — step-dots (center) — Next/Open Hay (right).
 *
 * All state is local. `onFinish` is invoked when the user skips or finishes;
 * the parent then hands off to the main Hay shell surface.
 */

type OnboardingStep = {
	id: string;
	title: string;
	sub: string;
	visual: () => JSX.Element;
};

/** Connect-provider card (prototype ConnectCard). */
const ConnectCard: Component<{
	provider: "Google" | "Microsoft";
	sub: string;
}> = (props) => (
	<div class="ob-connect-card">
		<div class="ob-connect-head">
			<span
				class="ob-connect-icon"
				classList={{
					"is-google": props.provider === "Google",
					"is-microsoft": props.provider === "Microsoft",
				}}
				aria-hidden="true"
			>
				<Mail size={20} stroke-width={2.5} />
			</span>
			<div class="ob-connect-meta">
				<div class="ob-connect-title">Connect {props.provider}</div>
				<div class="ob-connect-sub mono">{props.sub}</div>
			</div>
		</div>
		<button type="button" class="btn sm primary ob-connect-btn">
			Connect with OAuth
		</button>
	</div>
);

/** Category row (prototype CatRow). */
const CatRow: Component<{
	tone: "inbox" | "feed" | "paper";
	name: string;
	desc: string;
	icon: Component<{ size?: number; "stroke-width"?: number }>;
}> = (props) => (
	<div class="ob-cat-row">
		<span
			class="ob-cat-icon"
			classList={{ [`tone-${props.tone}`]: true }}
			aria-hidden="true"
		>
			<props.icon size={22} stroke-width={2.5} />
		</span>
		<div>
			<div class="ob-cat-name">{props.name}</div>
			<div class="ob-cat-desc">{props.desc}</div>
		</div>
	</div>
);

/** AI-extracted task/date row (prototype ExtractedRow). */
const ExtractedRow: Component<{
	tone: "paper" | "feed";
	label: string;
	due: string;
}> = (props) => (
	<div class="ob-extract-row">
		<span
			class="ob-extract-swatch"
			classList={{ [`tone-${props.tone}`]: true }}
			aria-hidden="true"
		/>
		<span class="ob-extract-label">{props.label}</span>
		<span class="ob-extract-due mono">{props.due}</span>
	</div>
);

const STEPS: OnboardingStep[] = [
	{
		id: "welcome",
		title: "Welcome to Hay.",
		sub: "A smarter inbox on top of your Gmail or Outlook account. We protect your attention — you keep your address.",
		visual: () => (
			<div class="ob-connect-grid">
				<ConnectCard provider="Google" sub="Gmail · Google Workspace" />
				<ConnectCard provider="Microsoft" sub="Outlook · Microsoft 365" />
			</div>
		),
	},
	{
		id: "screener",
		title: "Strangers go to the Screener.",
		sub: "First-time senders never reach your Inbox. You decide once — Accept into a category, or Reject. Hay routes the rest.",
		visual: () => (
			<div class="ob-screener-card">
				<div class="ob-screener-head">
					<span class="avatar ob-screener-avatar">MC</span>
					<div>
						<div class="ob-screener-name">Maya Chen</div>
						<div class="ob-screener-addr mono">maya@northstarcap.com</div>
					</div>
				</div>
				<div class="ob-screener-preview">
					<div class="ob-screener-subj">
						Intro — angel check for your seed round
					</div>
					<div class="ob-screener-body">
						Hi! I was forwarded your deck by Jamie. Quick context — I write
						$25–100k checks…
					</div>
				</div>
				<div class="ob-screener-actions">
					<div class="ob-screener-accept">ACCEPT</div>
					<div class="ob-screener-reject">REJECT</div>
				</div>
			</div>
		),
	},
	{
		id: "categories",
		title: "Three categories. No folders to manage.",
		sub: "Inbox is what demands attention. Feed is for newsletters and browse-later. Paper Trail holds receipts and confirmations.",
		visual: () => (
			<div class="ob-cat-list">
				<CatRow
					tone="inbox"
					name="Inbox"
					desc="Work, replies needed, the things that matter today."
					icon={Inbox}
				/>
				<CatRow
					tone="feed"
					name="Feed"
					desc="Newsletters, marketing, browse-later content. No notifications."
					icon={Newspaper}
				/>
				<CatRow
					tone="paper"
					name="Paper Trail"
					desc="Receipts, confirmations, shipping notices. Searchable, quiet."
					icon={Receipt}
				/>
			</div>
		),
	},
	{
		id: "assistant",
		title: "AI helps you triage. You stay in charge.",
		sub: "Hay suggests categories, summarizes long threads, surfaces tasks and dates, and answers questions about your mail. It never sends or deletes without you.",
		visual: () => (
			<div class="ob-ai-card">
				<div class="ob-ai-head">
					<Sparkles size={14} stroke-width={2.5} />
					<span>AI summary</span>
				</div>
				<div class="ob-ai-body">
					Priya is reviewing the Q3 hiring plan. Two concerns: pod A is one head
					short of the February projection, and she wants to move the design
					hire forward by six weeks. She'd like to discuss tomorrow.
				</div>
				<div class="ob-ai-extracted">
					<ExtractedRow
						tone="paper"
						label="Confirm pod A staffing"
						due="Before 1:1"
					/>
					<ExtractedRow
						tone="feed"
						label="1:1 with Priya — Q3 hiring follow-up"
						due="Tomorrow, 9:00 AM"
					/>
				</div>
			</div>
		),
	},
	{
		id: "new-mail-only",
		title: "Hay organizes new mail. Not old mail.",
		sub: "Your existing mailbox stays where it is. Hay's Screener and categories begin with whatever lands after you connect. Empty for now — that's the point.",
		visual: () => (
			<div class="ob-empty-card">
				<span class="ob-empty-icon" aria-hidden="true">
					<Inbox size={30} stroke-width={2.5} />
				</span>
				<h3>Your Inbox is empty.</h3>
				<p>
					That's because everyone is still unscreened. New mail will land in the
					Screener as it arrives — we'll show you.
				</p>
			</div>
		),
	},
];

export const ONBOARDING_STEP_COUNT = STEPS.length;

export const Onboarding: Component<{
	onFinish: () => void;
	/** Optional starting step index (clamped). Defaults to 0 (first run). */
	initialStep?: number;
}> = (props) => {
	const clampStep = (n: number) => Math.max(0, Math.min(n, STEPS.length - 1));
	const [index, setIndex] = createSignal(clampStep(props.initialStep ?? 0));

	// index() is always clamped to [0, STEPS.length - 1], so the lookup is safe.
	const step = (): OnboardingStep => STEPS[index()] as OnboardingStep;
	const isFirst = () => index() === 0;
	const isLast = () => index() === STEPS.length - 1;

	const next = () => {
		if (isLast()) {
			props.onFinish();
			return;
		}
		setIndex((i) => Math.min(i + 1, STEPS.length - 1));
	};

	const back = () => setIndex((i) => Math.max(i - 1, 0));

	return (
		<div
			class="onboarding"
			role="dialog"
			aria-modal="true"
			aria-label="Hay onboarding walkthrough"
		>
			<div class="onboarding-card">
				<div class="onboarding-head">
					<div class="row gap-8">
						<span class="logo">HAY.</span>
						<span class="mono-label" data-testid="ob-step-counter">
							Get started — {index() + 1}/{STEPS.length}
						</span>
					</div>
					<button
						type="button"
						class="btn sm ghost"
						onClick={() => props.onFinish()}
						data-testid="ob-skip"
					>
						Skip
					</button>
				</div>

				<div class="onboarding-body">
					<div class="ob-step" data-step-id={step().id}>
						<h1 class="ob-title">{step().title}</h1>
						<p class="ob-sub">{step().sub}</p>
						<div class="ob-visual">{step().visual()}</div>
					</div>
				</div>

				<div class="onboarding-foot">
					<button
						type="button"
						class="btn sm"
						disabled={isFirst()}
						onClick={back}
						data-testid="ob-back"
					>
						<ChevronLeft size={14} stroke-width={2.5} />
						<span>Back</span>
					</button>

					<div class="step-dots" aria-hidden="true">
						<For each={STEPS}>
							{(_, i) => (
								<span
									class="step-dot"
									classList={{ active: i() === index() }}
								/>
							)}
						</For>
					</div>

					<button
						type="button"
						class="btn sm primary"
						onClick={next}
						data-testid="ob-next"
					>
						<span>{isLast() ? "Open Hay" : "Next"}</span>
						<ChevronRight size={14} stroke-width={2.5} />
					</button>
				</div>
			</div>
		</div>
	);
};
