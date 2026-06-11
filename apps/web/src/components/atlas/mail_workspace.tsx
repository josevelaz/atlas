// Atlas — mail workspace (list + thread pane).
//
// Reads the selected row and the per-mail set-aside / reply-later toggle sets
// from the shared Atlas store (`atlas_state.tsx`) and dispatches selection /
// toggle actions through it, so the interaction state persists across SPA route
// changes. Renders the `MailList` (with the inbox AI banner) alongside the
// `ThreadView` for the current selection. Mirrors the list/pane half of the
// prototype's `App`.

import type { Component } from "solid-js";
import { createMemo } from "solid-js";
import {
	currentThread,
	listForView,
	listTitle,
	selectedIdForView,
} from "../../lib/atlas/app_state";
import { useAtlasActions, useAtlasState } from "../../lib/atlas/atlas_state";
import type { Screen, ScreenerDecisions } from "../../lib/atlas/types";
import { Button } from "../ui/index";
import { AtlasIcon } from "./atlas_icon";
import { MailList } from "./mail_list";
import { ThreadView } from "./thread_view";

export interface MailWorkspaceProps {
	view: Screen;
	decisions: ScreenerDecisions;
	/** Open the compose overlay as a reply, carrying the sender's address. */
	onCompose: (replyTo?: string) => void;
}

const MailWorkspace: Component<MailWorkspaceProps> = (props) => {
	const selection = useAtlasState((s) => s.selected);
	const setAside = useAtlasState((s) => s.setAside);
	const replyLater = useAtlasState((s) => s.replyLater);
	const actions = useAtlasActions();

	const list = createMemo(() => listForView(props.view, props.decisions));
	const selectedId = createMemo(() =>
		selectedIdForView(props.view, selection()),
	);
	const thread = createMemo(() =>
		currentThread(props.view, selection(), props.decisions),
	);

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
			<div class="atlas-list">
				<MailList
					title={listTitle(props.view)}
					items={list()}
					selectedId={selectedId()}
					onSelect={select}
					aiBanner={
						props.view === "inbox" ? (
							<div class="atlas-ai-banner">
								<AtlasIcon name="sparkle" size={12} color="#fff" stroke={2.5} />
								<span>2 P1 threads need a reply today.</span>
								<span class="atlas-spacer" />
								<Button size="sm">Sort by priority</Button>
							</div>
						) : undefined
					}
				/>
			</div>
			<div class="atlas-pane">
				<ThreadView
					thread={thread()}
					setAside={isSetAside()}
					replyLater={isReplyLater()}
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
