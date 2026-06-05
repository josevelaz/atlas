// Atlas — top-level app component for the mail workspace.
//
// Wires the shell together: top bar, sidebar nav, and the mail workspace. The
// active `view` and screener `decisions` are supplied by the route (they derive
// from the URL — path + `?d=` — so the screen and accepted-item counts are
// server-rendered correctly under the pre-existing broken-hydration constraint).
// Compose / assistant overlays land in later tasks, so their triggers are inert.

import type { Component } from "solid-js";
import { createMemo, createSignal } from "solid-js";
import { createInitialState, currentThread } from "../../lib/atlas/app_state";
import type {
	ComposeMode,
	Screen,
	ScreenerDecisions,
	SelectionState,
	ToggleSet,
} from "../../lib/atlas/types";
import { AppShell } from "./app_shell";
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
	// opens use the default Portal path.
	const composeInline = () => Boolean(props.initialCompose);

	return (
		<AppShell
			topBar={<TopBar onSearch={() => {}} onCompose={openNew} />}
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
		</AppShell>
	);
};

export { AtlasApp };
