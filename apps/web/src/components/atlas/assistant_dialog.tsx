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
// Open/close come from the shared Atlas store (`atlas_state.tsx`): the top-bar
// "Search or ask" button, `/`, and ⌘K open it; the header ✕, backdrop click,
// or Escape close it. The transcript and the in-progress query stay local to
// this component — the store only tracks open/closed.

import { Link } from "@tanstack/solid-router";
import type { Component } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import { viewForMailId } from "../../lib/atlas/app_state";
import {
	ASSISTANT_EXAMPLES,
	ASSISTANT_INTRO,
	answerQuery,
} from "../../lib/atlas/assistant_responses";
import { useAtlasActions } from "../../lib/atlas/atlas_state";
import { overlayHeadClasses } from "../../lib/atlas/component_classes";
import { atlasCiteLinkFor } from "../../lib/atlas/nav_links";
import type {
	AssistantCitation,
	AssistantMessage,
} from "../../lib/atlas/types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { AtlasIcon } from "./atlas_icon";

export interface AssistantDialogProps {
	/** Whether the overlay is open. */
	open: boolean;
	/** Close the overlay (header ✕, backdrop, Escape). */
	onClose: () => void;
}

const AssistantDialog: Component<AssistantDialogProps> = (props) => {
	const actions = useAtlasActions();

	// Local transcript, starting with the intro bubble. The store tracks only
	// open/closed; the conversation lives here.
	const [messages, setMessages] = createSignal<AssistantMessage[]>([
		ASSISTANT_INTRO,
	]);
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
	 * Screener citations simply route.
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
			class="atlas-assistant-card"
			aria-label="Ask Atlas"
		>
			<div
				class={cn(
					"atlas-overlay-head atlas-assistant-head",
					overlayHeadClasses,
				)}
			>
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
