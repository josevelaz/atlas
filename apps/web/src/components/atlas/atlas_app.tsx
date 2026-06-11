// Atlas — top-level app component for the mail workspace.
//
// Wires the shell together: top bar, sidebar nav, and the mail workspace. The
// active `view` is route-bound; the screener `decisions` are supplied by the
// route from the shared Atlas store, so accepted-item counts and lists update
// live as the Screener dispatches accept/reject actions.
//
// Compose and assistant overlay state live in the shared Atlas store
// (`atlas_state.tsx`): the top-bar Compose button, the thread Reply button, the
// "Search or ask" button, `/`, ⌘K, and Escape all dispatch store actions, so
// the overlay state persists across SPA navigation with no `?compose=` /
// `?ask=` / `?assistant=` tokens.

import type { Component } from "solid-js";
import { createEffect, createMemo, onCleanup } from "solid-js";
import {
	createInitialState,
	currentThread,
	resolveShortcut,
} from "../../lib/atlas/app_state";
import { useAtlasActions, useAtlasState } from "../../lib/atlas/atlas_state";
import type { Screen, ScreenerDecisions } from "../../lib/atlas/types";
import { AppShell } from "./app_shell";
import { AssistantDialog } from "./assistant_dialog";
import { ComposeDialog } from "./compose_dialog";
import { MailWorkspace } from "./mail_workspace";
import { SidebarNav, type SidebarNavProps } from "./sidebar_nav";
import { TopBar } from "./top_bar";

export interface AtlasAppProps {
	/** Active screen (route-bound). Defaults to "inbox". */
	view?: Screen;
	/** Screener decisions (from the shared Atlas store). Defaults to empty. */
	decisions?: ScreenerDecisions;
	/** Resolve nav `<Link>` targets for the sidebar. */
	linkFor?: SidebarNavProps["linkFor"];
}

const AtlasApp: Component<AtlasAppProps> = (props) => {
	const initial = createInitialState();
	const view = (): Screen => props.view ?? "inbox";
	const decisions = (): ScreenerDecisions =>
		props.decisions ?? initial.screener;

	const actions = useAtlasActions();

	// Compose + assistant overlay state from the shared store.
	const compose = useAtlasState((s) => s.compose);
	const assistantOpen = useAtlasState((s) => s.assistantOpen);

	// Resolve the selected thread's sender for the reply prefill, reading the
	// selection from the shared store. Mirrors the prototype's
	// `replyTo={currentMail ? currentMail.addr : ""}`.
	const selection = useAtlasState((s) => s.selected);
	const selectedReplyAddr = createMemo(() => {
		const thread = currentThread(view(), selection(), decisions());
		return thread?.addr ?? "";
	});

	// Open a blank compose from the top bar.
	const openCompose = () => actions.openCompose();
	// Open a reply: prefer the clicked-thread address, fall back to the selected
	// thread's sender.
	const openReply = (addr?: string) =>
		actions.openReply(addr || selectedReplyAddr());

	// Keyboard shortcuts. `/` and ⌘K/Ctrl-K open the assistant; `c` composes;
	// Escape dismisses overlays. Bound at the document level via the shared
	// `resolveShortcut` map.
	createEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const action = resolveShortcut(e);
			if (!action) return;
			if (action.kind === "assistant") {
				e.preventDefault();
				actions.openAssistant();
			} else if (action.kind === "compose") {
				actions.openCompose();
			} else if (action.kind === "dismiss-overlays") {
				actions.dismissOverlays();
			}
		};
		document.addEventListener("keydown", handler);
		onCleanup(() => document.removeEventListener("keydown", handler));
	});

	// The reply recipient: the address captured when the reply was opened, or
	// the selected thread's sender as a fallback.
	const replyTo = () => compose().replyAddr || selectedReplyAddr();

	return (
		<AppShell
			topBar={
				<TopBar
					onSearch={() => actions.openAssistant()}
					onCompose={openCompose}
				/>
			}
			sidebar={<SidebarNav activeView={view()} linkFor={props.linkFor} />}
		>
			<MailWorkspace
				view={view()}
				decisions={decisions()}
				onCompose={openReply}
			/>
			<ComposeDialog
				open={compose().mode !== "closed"}
				onClose={() => actions.closeCompose()}
				replyTo={compose().mode === "reply" ? replyTo() : undefined}
			/>
			<AssistantDialog
				open={assistantOpen()}
				onClose={() => actions.closeAssistant()}
			/>
		</AppShell>
	);
};

export { AtlasApp };
