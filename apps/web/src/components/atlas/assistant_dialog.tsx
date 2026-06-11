// Atlas — Ask Atlas assistant overlay (semantic search + canned chat).
//
// Mirrors the prototype's `Assistant` (`docs/prototype/screens.jsx`): an
// AI-keyed (electric-blue) overlay header, a scrolling chat transcript of
// user / AI bubbles, citation chips on AI replies, example prompt chips shown
// while only the intro bubble is present, an optional "Thinking…" busy bubble,
// and a footer ask form. Submitting an example or typed query appends a user
// bubble and the canned AI reply from `answerQuery` (`assistant_responses.ts`).
// Clicking a citation navigates to the referenced thread and closes the overlay.
//
// Closes via the header ✕, backdrop click, or Escape — routed through the
// shared `Dialog` primitive (`components/ui/dialog.tsx`).
//
// SSR-proof note: client hydration is disabled by a pre-existing TanStack
// Start/Solid error, so live `onClick` / `onSubmit` cannot be relied on for
// proof. The conversation can be seeded from the route (`?ask=<query>`) so the
// user + AI bubbles and citations render in the SSR stream; when seeded the
// `Dialog` is rendered with `inline` so the overlay is emitted server-side
// (Portal content is not). Live wiring (signals, submit, example clicks) stays
// in place for when hydration is fixed.

import { Link } from "@tanstack/solid-router";
import type { Component } from "solid-js";
import { For, Show, createSignal } from "solid-js";
import { viewForMailId } from "../../lib/atlas/app_state";
import { useAtlasActions } from "../../lib/atlas/atlas_state";
import {
	ASSISTANT_EXAMPLES,
	ASSISTANT_INTRO,
	answerQuery,
} from "../../lib/atlas/assistant_responses";
import { atlasCiteLinkFor } from "../../lib/atlas/nav_links";
import type {
	AssistantCitation,
	AssistantMessage,
} from "../../lib/atlas/types";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { AtlasIcon } from "./atlas_icon";

export interface AssistantDialogProps {
	/** Whether the overlay is open. */
	open: boolean;
	/** Close the overlay (header ✕, backdrop, Escape). */
	onClose: () => void;
	/**
	 * Render the overlay inline (in the SSR stream) instead of through a Portal.
	 * Required for SSR-proof variants while client hydration is unavailable.
	 */
	inline?: boolean;
	/**
	 * Seed the transcript with a submitted query (SSR-proof variant). When set,
	 * the intro bubble, the user's question, and the canned AI reply (plus its
	 * citations) are server-rendered so the chat-response state is observable.
	 */
	seededQuery?: string;
}

/** Build the seeded transcript for a server-rendered query (intro + Q + A). */
function seededTranscript(query: string): AssistantMessage[] {
	const user: AssistantMessage = { role: "user", text: query, cites: [] };
	return [ASSISTANT_INTRO, user, answerQuery(query)];
}

const AssistantDialog: Component<AssistantDialogProps> = (props) => {
	const actions = useAtlasActions();

	// Live transcript (used once hydration works). Seeded from `?ask=` for the
	// SSR-proof chat-response variant; otherwise just the intro bubble.
	const initial = (): AssistantMessage[] =>
		props.seededQuery ? seededTranscript(props.seededQuery) : [ASSISTANT_INTRO];

	const [messages, setMessages] = createSignal<AssistantMessage[]>(initial());
	const [query, setQuery] = createSignal("");
	const [busy, setBusy] = createSignal(false);

	/** Append the user's question and the canned reply (live path). */
	const ask = (text: string) => {
		const trimmed = text.trim();
		if (!trimmed) return;
		setMessages((m) => [...m, { role: "user", text: trimmed, cites: [] }]);
		setBusy(true);
		setQuery("");
		// Mirror the prototype's brief "thinking" delay before the canned reply.
		setTimeout(() => {
			setMessages((m) => [...m, answerQuery(trimmed)]);
			setBusy(false);
		}, 500);
	};

	const handleSubmit = (e: SubmitEvent) => {
		e.preventDefault();
		ask(query());
	};

	/** Show the example chips only while the intro bubble is alone. */
	const showExamples = () => messages().length === 1;

	const citeLink = (c: AssistantCitation) => atlasCiteLinkFor(c.id);

	/**
	 * Focus the cited thread through the shared store, then close the overlay.
	 * `select(view, id)` is a no-op for the Screener (no per-row selection), so
	 * Screener citations simply route. Replaces the old `?sel=` deep-link.
	 */
	const onCiteClick = (c: AssistantCitation) => {
		const view = viewForMailId(c.id);
		if (view) actions.select(view, c.id);
		props.onClose();
	};

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			inline={props.inline}
			class="atlas-assistant-card"
			aria-label="Ask Atlas"
		>
			<div class="atlas-overlay-head atlas-assistant-head">
				<div class="atlas-row atlas-gap-8">
					<AtlasIcon name="sparkle" size={18} color="#fff" stroke={2.5} />
					<h3 class="atlas-assistant-title">Ask Atlas</h3>
					<span class="atlas-assistant-chip">SEMANTIC SEARCH</span>
				</div>
				<Button
					size="sm"
					icon
					variant="ghost"
					onClick={props.onClose}
					aria-label="Close assistant"
					style={{ color: "#fff" }}
				>
					<AtlasIcon name="x" size={14} color="#fff" />
				</Button>
			</div>

			<div class="atlas-assistant-transcript">
				<For each={messages()}>
					{(m) => (
						<div class={`atlas-chat-bubble is-${m.role}`} data-role={m.role}>
							<div class="atlas-chat-text">{m.text}</div>
							<For each={m.cites}>
								{(c) => (
									<Show
										when={citeLink(c)}
										fallback={
											<div class="atlas-cite" data-cite={c.id}>
												<span class="atlas-cite-num">{c.num}</span>
												<div class="atlas-cite-body">
													<div class="atlas-cite-from">{c.from}</div>
													<div class="atlas-cite-subject">{c.subject}</div>
												</div>
												<span class="atlas-cite-time">{c.time}</span>
											</div>
										}
									>
										{(link) => (
											<Link
												to={link().to}
												search={link().search}
												class="atlas-cite"
												data-cite={c.id}
												onClick={() => onCiteClick(c)}
											>
												<span class="atlas-cite-num">{c.num}</span>
												<div class="atlas-cite-body">
													<div class="atlas-cite-from">{c.from}</div>
													<div class="atlas-cite-subject">{c.subject}</div>
												</div>
												<span class="atlas-cite-time">{c.time}</span>
											</Link>
										)}
									</Show>
								)}
							</For>
						</div>
					)}
				</For>

				<Show when={busy()}>
					<div class="atlas-chat-bubble is-ai atlas-chat-busy">Thinking…</div>
				</Show>

				<Show when={showExamples()}>
					<div class="atlas-assistant-examples">
						<div class="atlas-assistant-examples-label">Try</div>
						<div class="atlas-assistant-examples-list">
							<For each={ASSISTANT_EXAMPLES}>
								{(example) => (
									<Button
										size="sm"
										class="atlas-assistant-example"
										onClick={() => ask(example)}
									>
										{example}
									</Button>
								)}
							</For>
						</div>
					</div>
				</Show>
			</div>

			<div class="atlas-assistant-foot">
				<form class="atlas-row atlas-gap-8" onSubmit={handleSubmit}>
					<Input
						class="atlas-assistant-input"
						placeholder="Ask anything about your synced mail…"
						value={query()}
						onInput={(e) => setQuery(e.currentTarget.value)}
						aria-label="Ask Atlas"
					/>
					<Button variant="primary" type="submit" aria-label="Send question">
						<AtlasIcon name="send" size={14} />
					</Button>
				</form>
			</div>
		</Dialog>
	);
};

export { AssistantDialog };
