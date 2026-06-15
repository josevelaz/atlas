// Atlas — mail workspace (list + thread pane).
//
// The mail list and the open thread are server-backed through the mail query
// layer (`lib/mail/queries`): `useMailList(view)` fetches the active view's
// threads, and `useThread(selectedId)` fetches the selected thread's detail.
// Selection and the per-mail set-aside / reply-later toggles remain UI-only
// interaction state in the shared Atlas store (`atlas_state.tsx`), so they
// persist across SPA route changes. Renders the `MailList` (with the inbox AI
// banner) alongside the `ThreadView` for the current selection.

import type { Component } from "solid-js";
import { createMemo, createSignal } from "solid-js";

import { listTitle, selectedIdForView } from "../../lib/atlas/app_state";
import { useAtlasActions, useAtlasState } from "../../lib/atlas/atlas_state";
import {
	aiBannerButtonClasses,
	aiBannerClasses,
	listColumnClasses,
	paneClasses,
	spacerClasses,
} from "../../lib/atlas/component_classes";
import type { Screen } from "../../lib/atlas/types";
import { useMailList, useThreadDetail } from "../../lib/mail/queries";
import { Button } from "../ui/index";
import { AtlasIcon } from "./atlas_icon";
import { MailAccountFilter } from "./mail_account_filter";
import { MailList } from "./mail_list";
import { ThreadView } from "./thread_view";

export interface MailWorkspaceProps {
	view: Screen;
	/** Open the compose overlay as a reply, carrying the sender's address. */
	onCompose: (replyTo?: string) => void;
}

const MailWorkspace: Component<MailWorkspaceProps> = (props) => {
	const selection = useAtlasState((s) => s.selected);
	const setAside = useAtlasState((s) => s.setAside);
	const replyLater = useAtlasState((s) => s.replyLater);
	const actions = useAtlasActions();

	const view = () => props.view;
	// Unified-view account filter: undefined = all accounts (cross-account).
	const [accountFilter, setAccountFilter] = createSignal<string | undefined>(
		undefined,
	);
	const { items, isPending } = useMailList(view, accountFilter);

	const selectedId = createMemo(() =>
		selectedIdForView(props.view, selection()),
	);
	const { thread, bodyLoading, disconnected } = useThreadDetail(selectedId);

	const select = (id: string) => actions.select(props.view, id);

	const toggleSetAside = () => {
		const id = selectedId();
		if (id) actions.toggleSetAside(id);
	};
	const toggleReplyLater = () => {
		const id = selectedId();
		if (id) actions.toggleReplyLater(id);
	};

	const isSetAside = createMemo(() => {
		const id = selectedId();
		return id ? Boolean(setAside()[id]) : false;
	});
	const isReplyLater = createMemo(() => {
		const id = selectedId();
		return id ? Boolean(replyLater()[id]) : false;
	});

	return (
		<>
			<div class={listColumnClasses}>
				<MailList
					title={listTitle(props.view)}
					items={items()}
					loading={isPending()}
					selectedId={selectedId()}
					onSelect={select}
					accountFilter={
						<MailAccountFilter
							value={accountFilter()}
							onChange={setAccountFilter}
						/>
					}
					aiBanner={
						props.view === "inbox" ? (
							<div class={aiBannerClasses}>
								<AtlasIcon name="sparkle" size={12} color="#fff" stroke={2.5} />
								<span>2 P1 threads need a reply today.</span>
								<span class={spacerClasses} />
								<Button size="sm" class={aiBannerButtonClasses}>
									Sort by priority
								</Button>
							</div>
						) : undefined
					}
				/>
			</div>
			<div class={paneClasses}>
				<ThreadView
					thread={thread()}
					setAside={isSetAside()}
					replyLater={isReplyLater()}
					bodyLoading={bodyLoading()}
					disconnected={disconnected()}
					onReplyClick={props.onCompose}
					onArchive={() => {}}
					onTrash={() => {}}
					onSetAside={toggleSetAside}
					onReplyLater={toggleReplyLater}
				/>
			</div>
		</>
	);
};

export { MailWorkspace };
