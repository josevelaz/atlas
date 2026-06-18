// Atlas — thread pane.
//
// Toolbar (archive / trash / set-aside / reply-later + prev/next) → scrollable
// body: subject + chips, AI summary, message cards, and reply actions. Mirrors
// the prototype's `ThreadView`. Set-aside / reply-later are toggles whose active
// state fills the button with the yellow accent.

import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import {
	gap8Classes,
	messageAddrClasses,
	messageBodyClasses,
	messageClasses,
	messageDateClasses,
	messageHeadClasses,
	messageNameClasses,
	messageParaClasses,
	messageWhoClasses,
	rowClasses,
	tagAppClasses,
	tagClasses,
	threadBodyClasses,
	threadBodyLoadingClasses,
	threadBodyLoadingTextClasses,
	threadBodySkeletonClasses,
	threadClasses,
	threadDisconnectedBannerClasses,
	threadDisconnectedBodyClasses,
	threadDisconnectedTitleClasses,
	threadDividerClasses,
	threadTitleClasses,
	threadToolbarClasses,
} from "../../lib/atlas/component_classes";
import type { MailTag, Thread } from "../../lib/atlas/types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/index";
import { AiSummary } from "./ai_summary";
import { AtlasIcon } from "./atlas_icon";
import { EmptyState } from "./empty_state";
import { AtlasAvatar } from "./mail_row";
import { PriorityChip } from "./priority_chip";
import { ProvenanceChip } from "./provenance_chip";

function tagLabel(tag: MailTag): string {
	return tag.replace("-", " ");
}

export interface ThreadViewProps {
	thread: Thread | null;
	setAside: boolean;
	replyLater: boolean;
	/**
	 * Full message bodies are still being lazily fetched on open — show the
	 * body loading placeholder instead of the (empty) message stack.
	 */
	bodyLoading?: boolean;
	/**
	 * The thread's source account is disconnected (read-only): un-fetched
	 * bodies cannot be retrieved, so show the preview-only explanation banner.
	 */
	disconnected?: boolean;
	/** Open the reply overlay, carrying the open thread's sender address. */
	onReplyClick: (replyTo?: string) => void;
	onArchive: () => void;
	onTrash: () => void;
	onSetAside: () => void;
	onReplyLater: () => void;
}

const ThreadView: Component<ThreadViewProps> = (props) => {
	return (
		<Show
			when={props.thread}
			fallback={
				<EmptyState
					icon="inbox"
					heading="No thread selected"
					body="Pick something from the list to read it here."
				/>
			}
		>
			{(thread) => (
				<div class={threadClasses}>
					<div class={threadToolbarClasses}>
						<div class={cn(rowClasses, gap8Classes)}>
							<Button size="sm" onClick={props.onArchive}>
								<AtlasIcon name="archive" size={14} /> Archive
							</Button>
							<Button size="sm" onClick={props.onTrash}>
								<AtlasIcon name="trash" size={14} /> Trash
							</Button>
							<div class={threadDividerClasses} />
							<Button
								size="sm"
								variant={props.setAside ? "primary" : "default"}
								onClick={props.onSetAside}
								aria-pressed={props.setAside}
							>
								<AtlasIcon name="clock" size={14} /> Set aside
							</Button>
							<Button
								size="sm"
								variant={props.replyLater ? "primary" : "default"}
								onClick={props.onReplyLater}
								aria-pressed={props.replyLater}
							>
								<AtlasIcon name="reply" size={14} /> Reply later
							</Button>
						</div>
						<div class={cn(rowClasses, gap8Classes)}>
							<Button size="sm" icon aria-label="Previous thread">
								<AtlasIcon name="chevron-up" size={14} />
							</Button>
							<Button size="sm" icon aria-label="Next thread">
								<AtlasIcon name="chevron-down" size={14} />
							</Button>
						</div>
					</div>

					<div class={threadBodyClasses}>
						<div class="mb-[18px]">
							<h2 class={threadTitleClasses}>{thread().subject}</h2>
							<div class={cn(rowClasses, gap8Classes, "flex-wrap")}>
								<Show when={thread().priority}>
									{(p) => <PriorityChip priority={p()} withLabel />}
								</Show>
								<span class={cn(tagClasses, tagAppClasses)}>
									<AtlasIcon name="inbox" size={11} /> Inbox
								</span>
								<For each={thread().tags ?? []}>
									{(tag) => (
										<span class={cn(tagClasses, tagAppClasses)}>
											{tagLabel(tag)}
										</span>
									)}
								</For>
								{/* Account provenance — always visible so the open thread is
								    attributed to its source mailbox in the unified views. */}
								<Show when={thread().provenance}>
									{(p) => <ProvenanceChip provenance={p()} />}
								</Show>
							</div>
						</div>

						<Show when={thread().body}>
							{(body) => <AiSummary body={body()} />}
						</Show>

						{/* Disconnected source: bodies cannot be fetched — explain the
						    preview-only state instead of an empty/spinning body. */}
						<Show when={props.disconnected}>
							<div
								class={threadDisconnectedBannerClasses}
								data-state="account-disconnected"
							>
								<AtlasIcon name="shield" size={16} stroke={2.5} />
								<div>
									<div class={threadDisconnectedTitleClasses}>
										This account is disconnected — showing previews only.
									</div>
									<div class={threadDisconnectedBodyClasses}>
										Full message bodies can't be fetched while the source
										mailbox is disconnected. Reconnect the account in Settings
										to load the rest of this thread.
									</div>
								</div>
							</div>
						</Show>

						{/* Lazy body load: bodies are still being fetched on open. */}
						<Show when={props.bodyLoading && !props.disconnected}>
							<div
								class={threadBodyLoadingClasses}
								role="status"
								aria-live="polite"
								data-state="body-loading"
							>
								<span class={threadBodyLoadingTextClasses}>
									Loading message…
								</span>
								<span class={threadBodySkeletonClasses} aria-hidden="true" />
							</div>
						</Show>

						<For each={thread().body?.messages ?? []}>
							{(message) => (
								<div class={messageClasses}>
									<div class={messageHeadClasses}>
										<AtlasAvatar name={message.from} />
										<div class={messageWhoClasses}>
											<div class={messageNameClasses}>{message.from}</div>
											<div class={messageAddrClasses}>{message.addr}</div>
										</div>
										<div class={messageDateClasses}>{message.time}</div>
									</div>
									<div class={messageBodyClasses}>
										<For each={message.body}>
											{(p) => <p class={messageParaClasses}>{p}</p>}
										</For>
									</div>
								</div>
							)}
						</For>

						<div class={cn(rowClasses, gap8Classes, "mt-[18px] flex-wrap")}>
							<Button
								variant="primary"
								onClick={() => props.onReplyClick(thread().addr)}
							>
								<AtlasIcon name="reply" size={14} stroke={2.5} /> Reply
							</Button>
							<Button>
								<AtlasIcon name="reply-all" size={14} /> Reply all
							</Button>
							<Button>
								<AtlasIcon name="forward" size={14} /> Forward
							</Button>
						</div>
					</div>
				</div>
			)}
		</Show>
	);
};

export { ThreadView };
