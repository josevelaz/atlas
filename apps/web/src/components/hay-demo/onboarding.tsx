import { Inbox, Mailbox, ShieldCheck, Sparkles, Tags } from "lucide-solid";
import type { Component, JSX } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

/**
 * Onboarding — multi-step first-run walkthrough for the /dev/hay-inbox demo.
 *
 * Recreates the prototype's onboarding flow (docs/prototype/hay-inbox-prototype.html):
 *   - Branded HAY wordmark + "step N of M" mono label in the card header
 *   - Card-based body with an icon, heading, description, and preview visual
 *   - Step-dot progress indicator + Back / Skip / Next-or-Finish controls
 *
 * All state is local. The flow themes match spec Unit 1:
 *   1. Mailbox connection
 *   2. Screener explanation
 *   3. Category explanation
 *   4. AI assistance explanation
 *   5. New-mail-only disclosure
 *
 * `onFinish` is invoked when the user skips or finishes; the parent then hands
 * off to the main Hay shell surface.
 */

type OnboardingStep = {
	id: string;
	icon: Component<{ size?: number; "stroke-width"?: number }>;
	title: string;
	body: string;
	preview: JSX.Element;
};

const STEPS: OnboardingStep[] = [
	{
		id: "connect",
		icon: Mailbox,
		title: "Connect your mailbox",
		body: "Hay organizes the mail you already have. Connect Gmail or Outlook / Microsoft 365 and Hay starts working in the background — no new email address, no migration.",
		preview: (
			<div class="ob-preview">
				<div class="ob-preview-row">
					<span class="ob-chip">Gmail</span>
					<span>Connect your Google mailbox</span>
				</div>
				<div class="ob-preview-row">
					<span class="ob-chip">Outlook</span>
					<span>Connect Microsoft 365</span>
				</div>
			</div>
		),
	},
	{
		id: "screener",
		icon: ShieldCheck,
		title: "The Screener decides who gets in",
		body: "First-time senders land in the Screener. Accept them once and their mail flows to the right place from then on. Reject them and they stay out of your inbox for good.",
		preview: (
			<div class="ob-preview">
				<div class="ob-preview-row">
					<span class="ob-chip">New</span>
					<span>updates@launch.dev wants to reach you</span>
				</div>
				<div class="ob-preview-row">
					<span class="ob-chip">Accept</span>
					<span>Route future mail into a category</span>
				</div>
			</div>
		),
	},
	{
		id: "categories",
		icon: Tags,
		title: "Everything sorts into categories",
		body: "Accepted mail flows into Inbox, Feed, and Paper Trail. People you reply to land in Inbox. Newsletters and broadcasts go to Feed. Receipts and confirmations file into Paper Trail.",
		preview: (
			<div class="ob-preview">
				<div class="ob-preview-row">
					<span
						class="ob-chip"
						style={{ "border-color": "var(--color-inbox)" }}
					>
						Inbox
					</span>
					<span>Conversations with real people</span>
				</div>
				<div class="ob-preview-row">
					<span class="ob-chip" style={{ "border-color": "var(--color-feed)" }}>
						Feed
					</span>
					<span>Newsletters &amp; broadcasts</span>
				</div>
				<div class="ob-preview-row">
					<span
						class="ob-chip"
						style={{ "border-color": "var(--color-paper)" }}
					>
						Paper
					</span>
					<span>Receipts &amp; confirmations</span>
				</div>
			</div>
		),
	},
	{
		id: "assistant",
		icon: Sparkles,
		title: "Ask Hay anything",
		body: "Hay summarizes long threads, extracts tasks and dates, and answers questions about your mail with cited sources. Ask in plain language — Hay points you straight to the receipts.",
		preview: (
			<div class="ob-preview">
				<div class="ob-preview-row">
					<span class="ob-chip">Ask</span>
					<span>“When is the invoice from Acme due?”</span>
				</div>
				<div class="ob-preview-row">
					<span class="ob-chip" style={{ "border-color": "var(--color-ai)" }}>
						Hay
					</span>
					<span>Due Friday — see “Invoice #4821”.</span>
				</div>
			</div>
		),
	},
	{
		id: "new-mail-only",
		icon: Inbox,
		title: "New mail only",
		body: "Hay organizes mail that arrives after you connect. Your existing messages are never imported, analyzed, or moved. Everyone starts unscreened — Hay learns as you triage.",
		preview: (
			<div class="ob-preview">
				<div class="ob-preview-row">
					<span class="ob-chip">Today</span>
					<span>New mail is screened &amp; sorted</span>
				</div>
				<div class="ob-preview-row">
					<span class="ob-chip">History</span>
					<span>Left untouched, never imported</span>
				</div>
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
					<span class="wordmark">HAY</span>
					<span class="mono-label" data-testid="ob-step-counter">
						Step {index() + 1} of {STEPS.length}
					</span>
				</div>

				<div class="onboarding-body">
					<div class="ob-step" data-step-id={step().id}>
						<span class="ob-icon" aria-hidden="true">
							<Dynamic component={step().icon} size={28} stroke-width={2.5} />
						</span>
						<h2>{step().title}</h2>
						<p>{step().body}</p>
						{step().preview}
					</div>
				</div>

				<div class="onboarding-foot">
					<div class="step-dots" aria-hidden="true">
						<For each={STEPS}>
							{(_, i) => (
								<span class="step-dot" classList={{ active: i() <= index() }} />
							)}
						</For>
					</div>

					<div style={{ display: "flex", gap: "8px" }}>
						<Show when={!isFirst()}>
							<button type="button" class="btn ghost" onClick={back}>
								Back
							</button>
						</Show>
						<button
							type="button"
							class="btn ghost"
							onClick={() => props.onFinish()}
							data-testid="ob-skip"
						>
							Skip
						</button>
						<button
							type="button"
							class="btn primary"
							onClick={next}
							data-testid="ob-next"
						>
							{isLast() ? "Open Hay" : "Next"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
