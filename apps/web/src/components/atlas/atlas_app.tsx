// Atlas — top-level app component for the mail workspace.
//
// Wires the shell together: top bar, sidebar nav, and the mail workspace. The
// active `view` and screener `decisions` are supplied by the route (they derive
// from the URL — path + `?d=` — so the screen and accepted-item counts are
// server-rendered correctly under the pre-existing broken-hydration constraint).
// Compose / assistant overlays land in later tasks, so their triggers are inert.

import type { Component } from "solid-js";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import {
	createInitialState,
	currentThread,
	encodeDecisions,
	resolveShortcut,
} from "../../lib/atlas/app_state";
import type {
	ComposeMode,
	Screen,
	ScreenerDecisions,
	SelectionState,
	ToggleSet,
} from "../../lib/atlas/types";
import { AppShell } from "./app_shell";
import { AssistantDialog } from "./assistant_dialog";
import { ComposeDialog } from "./compose_dialog";
import { MailWorkspace } from "./mail_workspace";
import { SidebarNav, type SidebarNavProps } from "./sidebar_nav";
import { TopBar } from "./top_bar";

export interface AtlasAppProps {
	/** Active screen (route-bound). Defaults to "inbox". */
	view?: Screen;
	/** Screener decisions (decoded from the route's `?d=`). Defaults to empty. */
	decisions?: ScreenerDecisions;
	/** Resolve SSR-proof nav `<Link>` targets (carries the current `?d=`). */
	linkFor?: SidebarNavProps["linkFor"];
	/**
	 * Optional initial selected mail id (proof variants). Seeds the thread pane
	 * server-side so row selection is observable without client hydration.
	 */
	initialSelectedId?: string;
	/** Optional initial set-aside toggle map (proof variants). */
	initialSetAside?: ToggleSet;
	/** Optional initial reply-later toggle map (proof variants). */
	initialReplyLater?: ToggleSet;
	/**
	 * Optional initial compose overlay mode (proof variants). `"new"` opens a
	 * blank compose, `"reply"` opens a reply prefilled from the selected thread's
	 * sender. Defaults to `"closed"`. Because client hydration is unavailable,
	 * the overlay renders inline (in the SSR stream) when this is not closed.
	 */
	initialCompose?: ComposeMode;
	/**
	 * Optional initial Ask Atlas query (proof variant). When set, the assistant
	 * overlay opens server-side with the intro bubble, the seeded question, and
	 * the canned AI reply (plus citations) rendered inline in the SSR stream so
	 * the chat-response and citation states are observable without hydration.
	 */
	initialAsk?: string;
	/**
	 * Open the assistant overlay server-side in its initial state (intro bubble
	 * + example prompt chips), without a seeded query (proof variant). Implied
	 * when `initialAsk` is set.
	 */
	initialAssistantOpen?: boolean;
}

const AtlasApp: Component<AtlasAppProps> = (props) => {
	const initial = createInitialState();
	const view = (): Screen => props.view ?? "inbox";
	const decisions = (): ScreenerDecisions =>
		props.decisions ?? initial.screener;

	// Compose overlay state. Seeded from the route's `?compose=` (proof variant)
	// so the New-message / Reply states are server-rendered; the topbar Compose
	// button and thread Reply button also drive it live once hydration works.
	const [compose, setCompose] = createSignal<ComposeMode>(
		props.initialCompose ?? "closed",
	);
	// The recipient captured when opening a reply from a thread (live path).
	const [liveReplyAddr, setLiveReplyAddr] = createSignal<string>("");
	const openNew = () => setCompose("new");
	const openReply = (addr?: string) => {
		setLiveReplyAddr(addr ?? "");
		setCompose("reply");
	};
	const closeCompose = () => setCompose("closed");

	// Assistant (Ask Atlas) overlay state. Seeded from the route's `?ask=` (proof
	// variant) so the chat-response state is server-rendered; the topbar "Search
	// or ask" button, `/`, and ⌘K/Ctrl-K also drive it live once hydration works.
	const [assistantOpen, setAssistantOpen] = createSignal<boolean>(
		Boolean(props.initialAsk) || Boolean(props.initialAssistantOpen),
	);
	const openAssistant = () => setAssistantOpen(true);
	const closeAssistant = () => setAssistantOpen(false);

	// Keyboard shortcuts (live path). `/` and ⌘K/Ctrl-K open the assistant; `c`
	// composes; Escape dismisses overlays. Bound at the document level via the
	// shared `resolveShortcut` map; inert under broken hydration but ready.
	createEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const action = resolveShortcut(e);
			if (!action) return;
			if (action.kind === "assistant") {
				e.preventDefault();
				openAssistant();
			} else if (action.kind === "compose") {
				openNew();
			} else if (action.kind === "dismiss-overlays") {
				closeCompose();
				closeAssistant();
			}
		};
		document.addEventListener("keydown", handler);
		onCleanup(() => document.removeEventListener("keydown", handler));
	});

	// Resolve the selected thread's sender for the SSR-proof reply prefill.
	// Mirrors the prototype's `replyTo={currentMail ? currentMail.addr : ""}`.
	const seededSelection = (): SelectionState => {
		const id = props.initialSelectedId;
		if (!id) return initial.selected;
		if (view() === "inbox") return { ...initial.selected, inbox: id };
		if (view() === "feed") return { ...initial.selected, feed: id };
		if (view() === "paper") return { ...initial.selected, paper: id };
		return initial.selected;
	};
	const seededReplyAddr = createMemo(() => {
		const thread = currentThread(view(), seededSelection(), decisions());
		return thread?.addr ?? "";
	});
	// Prefer the live (clicked-thread) address; fall back to the SSR-seeded one.
	const replyAddr = () => liveReplyAddr() || seededReplyAddr();

	// SSR-proof: when a compose mode is seeded, render the overlay inline so it
	// is emitted in the server stream (Portal content is not). Live (hydrated)
	// opens use the default Portal path. The assistant follows the same rule.
	const composeInline = () => Boolean(props.initialCompose);
	const assistantInline = () =>
		Boolean(props.initialAsk) || Boolean(props.initialAssistantOpen);

	// Serialize the current decisions so citation deep-links stay consistent
	// with the rest of the session (carries the `?d=` token-string through).
	const decisionsToken = createMemo(() => encodeDecisions(decisions()));

	return (
		<AppShell
			topBar={<TopBar onSearch={openAssistant} onCompose={openNew} />}
			sidebar={
				<SidebarNav
					activeView={view()}
					decisions={decisions()}
					linkFor={props.linkFor}
				/>
			}
		>
			<MailWorkspace
				view={view()}
				decisions={decisions()}
				onCompose={openReply}
				initialSelectedId={props.initialSelectedId}
				initialSetAside={props.initialSetAside}
				initialReplyLater={props.initialReplyLater}
			/>
			<ComposeDialog
				open={compose() !== "closed"}
				onClose={closeCompose}
				replyTo={compose() === "reply" ? replyAddr() : undefined}
				inline={composeInline()}
			/>
			<AssistantDialog
				open={assistantOpen()}
				onClose={closeAssistant}
				inline={assistantInline()}
				seededQuery={props.initialAsk}
				decisions={decisionsToken() || undefined}
			/>
		</AppShell>
	);
};

export { AtlasApp };
