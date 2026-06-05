// Atlas — mail workspace (list + thread pane).
//
// Owns the local interaction state for the inbox slice: selected row, and the
// per-mail set-aside / reply-later toggle sets. Renders the `MailList` (with the
// inbox AI banner) alongside the `ThreadView` for the current selection.
// Mirrors the list/pane half of the prototype's `App`.

import type { Component } from "solid-js";
import { createMemo, createSignal } from "solid-js";
import {
	createInitialState,
	currentThread,
	listForView,
	listTitle,
	selectInView,
} from "../../lib/atlas/app_state";
import type {
	Screen,
	ScreenerDecisions,
	SelectionState,
	ToggleSet,
} from "../../lib/atlas/types";
import { Button } from "../ui/index";
import { AtlasIcon } from "./atlas_icon";
import { MailList } from "./mail_list";
import { ThreadView } from "./thread_view";

export interface MailWorkspaceProps {
	view: Screen;
	decisions: ScreenerDecisions;
	/** Open the compose overlay (reply action). */
	onCompose: () => void;
	/**
	 * Optional initial selected mail id for the active list. Lets the route seed
	 * the selection server-side (proof variants) so "selecting a row updates the
	 * pane" is observable even when client hydration is unavailable.
	 */
	initialSelectedId?: string;
	/** Optional initial set-aside toggle map (proof variants). */
	initialSetAside?: ToggleSet;
	/** Optional initial reply-later toggle map (proof variants). */
	initialReplyLater?: ToggleSet;
}

const MailWorkspace: Component<MailWorkspaceProps> = (props) => {
	const initial = createInitialState();
	const seededSelection = (): SelectionState => {
		if (!props.initialSelectedId) return initial.selected;
		return selectInView(props.view, initial.selected, props.initialSelectedId);
	};
	const [selection, setSelection] = createSignal<SelectionState>(
		seededSelection(),
	);
	const [setAside, setSetAside] = createSignal<ToggleSet>(
		props.initialSetAside ?? {},
	);
	const [replyLater, setReplyLater] = createSignal<ToggleSet>(
		props.initialReplyLater ?? {},
	);

	const list = createMemo(() => listForView(props.view, props.decisions));
	const selectedId = createMemo(() => {
		const sel = selection();
		if (props.view === "inbox") return sel.inbox;
		if (props.view === "feed") return sel.feed;
		if (props.view === "paper") return sel.paper;
		return null;
	});
	const thread = createMemo(() =>
		currentThread(props.view, selection(), props.decisions),
	);

	const select = (id: string) => {
		setSelection((s) => selectInView(props.view, s, id));
	};

	const toggleSetAside = () => {
		const id = selectedId();
		if (!id) return;
		setSetAside((s) => ({ ...s, [id]: !s[id] }));
	};
	const toggleReplyLater = () => {
		const id = selectedId();
		if (!id) return;
		setReplyLater((s) => ({ ...s, [id]: !s[id] }));
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
