// Atlas — the single application shell for every Atlas screen.
//
// `AtlasApp` is the one shell that all Atlas routes render. Each route only
// selects its active `view` and renders `<AtlasApp view="..." />`; this
// component owns the top bar, sidebar nav, and the active workspace region,
// switching its content by `view`:
//   - "inbox" / "feed" / "paper" → the mail workspace (list + thread pane),
//   - "screener"                 → the full-width Screener region,
//   - "tasks"                    → the full-width Tasks & Dates region,
//   - "settings"                 → the full-width Settings region.
//
// Screener decisions are read from the shared Atlas store (`atlas_state.tsx`),
// so accepted-item counts and lists update live as the Screener dispatches
// accept/reject actions. Sidebar `<Link>` targets are resolved once via the
// shared `atlasMailLinkFor()` resolver.
//
// Compose and assistant overlay state also live in the shared store: the
// top-bar Compose button, the thread Reply button, the "Search or ask" button,
// `/`, ⌘K, and Escape all dispatch store actions, so the overlay state persists
// across SPA navigation. The overlays and the interactive top-bar callbacks are
// wired only on the mail workspace views; the full-width screens keep an inert
// top bar.

import type { Component } from "solid-js";
import { createEffect, createMemo, Match, onCleanup, Switch } from "solid-js";
import { resolveShortcut, selectedIdForView } from "../../lib/atlas/app_state";
import { useAtlasActions, useAtlasState } from "../../lib/atlas/atlas_state";
import {
	fullPaneClasses,
	listWideClasses,
} from "../../lib/atlas/component_classes";
import { atlasMailLinkFor } from "../../lib/atlas/nav_links";
import type { Screen } from "../../lib/atlas/types";
import { useThread } from "../../lib/mail/queries";
import { AppShell } from "./app_shell";
import { AssistantDialog } from "./assistant_dialog";
import { ComposeDialog } from "./compose_dialog";
import { MailWorkspace } from "./mail_workspace";
import { ScreenerScreen } from "./screener_screen";
import { SettingsScreen } from "./settings_screen";
import { SidebarNav } from "./sidebar_nav";
import { TasksScreen } from "./tasks_screen";
import { TopBar } from "./top_bar";

export interface AtlasAppProps {
	/** Active screen (route-bound). Defaults to "inbox". */
	view?: Screen;
}

/** The mail workspace views — the only views with list/pane + overlay wiring. */
function isMailView(view: Screen): boolean {
	return (
		view === "inbox" || view === "feed" || view === "paper" || view === "spam"
	);
}

const AtlasApp: Component<AtlasAppProps> = (props) => {
	const view = (): Screen => props.view ?? "inbox";

	const actions = useAtlasActions();
	const linkFor = atlasMailLinkFor();

	// Compose + assistant overlay state from the shared store.
	const compose = useAtlasState((s) => s.compose);
	const assistantOpen = useAtlasState((s) => s.assistantOpen);

	// Resolve the selected thread's sender for the reply prefill. Selection is
	// UI-only store state; the thread detail (and thus the sender address) is
	// server-backed via the mail query layer. The query is shared/cached with
	// the workspace's `useThread`, so this does not refetch.
	const selection = useAtlasState((s) => s.selected);
	const selectedId = createMemo(() => selectedIdForView(view(), selection()));
	const selectedThread = useThread(selectedId);
	const selectedReplyAddr = createMemo(() => selectedThread()?.addr ?? "");

	// Open a blank compose from the top bar.
	const openCompose = () => actions.openCompose();
	// Open a reply: prefer the clicked-thread address, fall back to the selected
	// thread's sender.
	const openReply = (addr?: string) =>
		actions.openReply(addr || selectedReplyAddr());

	// Keyboard shortcuts. `/` and ⌘K/Ctrl-K open the assistant; `c` composes;
	// Escape dismisses overlays. Bound at the document level via the shared
	// `resolveShortcut` map. Only the mail workspace exposes the overlays, so the
	// shortcuts are inert on the full-width screens.
	createEffect(() => {
		if (!isMailView(view())) return;
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

	const noop = () => {};

	return (
		<AppShell
			topBar={
				<Switch fallback={<TopBar onSearch={noop} onCompose={noop} />}>
					<Match when={isMailView(view())}>
						<TopBar
							onSearch={() => actions.openAssistant()}
							onCompose={openCompose}
						/>
					</Match>
				</Switch>
			}
			sidebar={<SidebarNav activeView={view()} linkFor={linkFor} />}
		>
			<Switch>
				<Match when={isMailView(view())}>
					<MailWorkspace view={view()} onCompose={openReply} />
					<ComposeDialog
						open={compose().mode !== "closed"}
						onClose={() => actions.closeCompose()}
						replyTo={compose().mode === "reply" ? replyTo() : undefined}
					/>
					<AssistantDialog
						open={assistantOpen()}
						onClose={() => actions.closeAssistant()}
					/>
				</Match>
				<Match when={view() === "screener"}>
					<div class={listWideClasses}>
						<ScreenerScreen />
					</div>
				</Match>
				<Match when={view() === "tasks"}>
					<div class={fullPaneClasses}>
						<TasksScreen />
					</div>
				</Match>
				<Match when={view() === "settings"}>
					<div class={fullPaneClasses}>
						<SettingsScreen />
					</div>
				</Match>
			</Switch>
		</AppShell>
	);
};

export { AtlasApp };
