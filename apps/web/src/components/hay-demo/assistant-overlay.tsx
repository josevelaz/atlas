import { Send, Sparkles, X } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import {
	ASSISTANT_EXAMPLES,
	ASSISTANT_GREETING,
	type AssistantMessage,
	assistantReply,
} from "./hay-inbox-data";

/**
 * AssistantOverlay — prototype-faithful "Ask Hay" / search assistant overlay.
 *
 * Recreates the prototype's `.overlay` > `.overlay-card` chat composition:
 *   - `.overlay-head`: an AI-accent header with the sparkle icon, "Ask Hay"
 *     title, a "SEMANTIC SEARCH" badge, and a close button.
 *   - A scrollable message stack of `.chat-bubble` (ai / user). AI bubbles can
 *     carry `.cite` rows — cited results that, when clicked, open the matching
 *     demo thread and close the overlay.
 *   - Before the first question, an example-prompt list (`Try`) is shown.
 *   - A footer input + Send button. Submitting appends the user's message and,
 *     after a short "Thinking…" delay, a canned AI reply.
 *
 * All conversation content is LOCAL/DEMO-ONLY mock data — no real search, no
 * network, no mailbox access. `onOpenThread` lets the parent shell route to a
 * cited thread.
 */
export const AssistantOverlay: Component<{
	onClose: () => void;
	onOpenThread: (threadId: string) => void;
}> = (props) => {
	const [q, setQ] = createSignal("");
	const [messages, setMessages] = createSignal<AssistantMessage[]>([
		ASSISTANT_GREETING,
	]);
	const [busy, setBusy] = createSignal(false);

	const ask = (text: string) => {
		const trimmed = text.trim();
		if (!trimmed || busy()) return;
		setMessages((m) => [...m, { role: "user", text: trimmed }]);
		setQ("");
		setBusy(true);
		// Mock latency for the "Thinking…" affordance.
		setTimeout(() => {
			setMessages((m) => [...m, assistantReply(trimmed)]);
			setBusy(false);
		}, 450);
	};

	const openThread = (threadId: string) => {
		props.onOpenThread(threadId);
		props.onClose();
	};

	return (
		<div
			class="overlay"
			data-testid="assistant-overlay"
			role="dialog"
			aria-modal="true"
			aria-label="Ask Hay"
			onClick={() => props.onClose()}
			onKeyDown={(e) => {
				if (e.key === "Escape") props.onClose();
			}}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss pattern; inner card stops propagation */}
			<div
				class="overlay-card assistant-card"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div class="overlay-head assistant-head">
					<div class="row gap-8">
						<Sparkles size={18} stroke-width={2.5} />
						<h3>Ask Hay</h3>
						<span class="assistant-badge">Semantic search</span>
					</div>
					<button
						type="button"
						class="btn icon ghost assistant-close"
						data-testid="assistant-close"
						aria-label="Close Ask Hay"
						onClick={() => props.onClose()}
					>
						<X size={16} stroke-width={2.5} />
					</button>
				</div>

				<div class="assistant-body" data-testid="assistant-messages">
					<For each={messages()}>
						{(m) => (
							<div class="chat-bubble" classList={{ [m.role]: true }}>
								<div class="chat-text">{m.text}</div>
								<Show when={m.cites && m.cites.length > 0}>
									<For each={m.cites}>
										{(c) => (
											<button
												type="button"
												class="cite"
												data-testid={`cite-${c.threadId}`}
												onClick={() => openThread(c.threadId)}
											>
												<span class="cite-num">{c.num}</span>
												<span class="cite-body">
													<span class="cite-from">{c.from}</span>
													<span class="cite-subject">{c.subject}</span>
												</span>
												<span class="cite-time">{c.time}</span>
											</button>
										)}
									</For>
								</Show>
							</div>
						)}
					</For>

					<Show when={busy()}>
						<div
							class="chat-bubble ai thinking"
							data-testid="assistant-thinking"
						>
							Thinking…
						</div>
					</Show>

					<Show when={messages().length === 1}>
						<div class="assistant-examples" data-testid="assistant-examples">
							<span class="examples-label">Try</span>
							<For each={ASSISTANT_EXAMPLES}>
								{(ex) => (
									<button
										type="button"
										class="btn sm example-prompt"
										onClick={() => ask(ex)}
									>
										{ex}
									</button>
								)}
							</For>
						</div>
					</Show>
				</div>

				<div class="assistant-foot">
					<form
						class="row gap-8"
						onSubmit={(e) => {
							e.preventDefault();
							ask(q());
						}}
					>
						<input
							class="input assistant-input"
							data-testid="assistant-input"
							placeholder="Ask anything about your synced mail…"
							value={q()}
							autofocus
							onInput={(e) => setQ(e.currentTarget.value)}
						/>
						<button
							type="submit"
							class="btn primary icon"
							data-testid="assistant-send"
							aria-label="Send"
						>
							<Send size={15} stroke-width={2.5} />
						</button>
					</form>
				</div>
			</div>
		</div>
	);
};
