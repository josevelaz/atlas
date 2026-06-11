// Atlas — thread pane.
//
// Toolbar (archive / trash / set-aside / reply-later + prev/next) → scrollable
// body: subject + chips, AI summary, message cards, and reply actions. Mirrors
// the prototype's `ThreadView`. Set-aside / reply-later are toggles whose active
// state fills the button with the yellow accent.

import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { tagAppClasses, tagClasses } from "../../lib/atlas/component_classes";
import type { MailTag, Thread } from "../../lib/atlas/types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/index";
import { AiSummary } from "./ai_summary";
import { AtlasIcon } from "./atlas_icon";
import { EmptyState } from "./empty_state";
import { AtlasAvatar } from "./mail_row";
import { PriorityChip } from "./priority_chip";

function tagLabel(tag: MailTag): string {
	return tag.replace("-", " ");
}

export interface ThreadViewProps {
	thread: Thread | null;
	setAside: boolean;
	replyLater: boolean;
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
				<div class="atlas-thread">
					<div class="atlas-thread-toolbar">
						<div class="atlas-row atlas-gap-8">
							<Button size="sm" onClick={props.onArchive}>
								<AtlasIcon name="archive" size={14} /> Archive
							</Button>
							<Button size="sm" onClick={props.onTrash}>
								<AtlasIcon name="trash" size={14} /> Trash
							</Button>
							<div
								style={{
									width: "1px",
									height: "20px",
									background: "var(--color-border)",
								}}
							/>
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
						<div class="atlas-row atlas-gap-8">
							<Button size="sm" icon aria-label="Previous thread">
								<AtlasIcon name="chevron-up" size={14} />
							</Button>
							<Button size="sm" icon aria-label="Next thread">
								<AtlasIcon name="chevron-down" size={14} />
							</Button>
						</div>
					</div>

					<div class="atlas-thread-body">
						<div style={{ "margin-bottom": "18px" }}>
							<h2 class="atlas-thread-title">{thread().subject}</h2>
							<div
								class="atlas-row atlas-gap-8"
								style={{ "flex-wrap": "wrap" }}
							>
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
							</div>
						</div>

						<Show when={thread().body}>
							{(body) => <AiSummary body={body()} />}
						</Show>

						<For each={thread().body?.messages ?? []}>
							{(message) => (
								<div class="atlas-message">
									<div class="atlas-message-head">
										<AtlasAvatar name={message.from} />
										<div class="atlas-who">
											<div class="atlas-name">{message.from}</div>
											<div class="atlas-addr">{message.addr}</div>
										</div>
										<div class="atlas-date">{message.time}</div>
									</div>
									<div class="atlas-message-body">
										<For each={message.body}>{(p) => <p>{p}</p>}</For>
									</div>
								</div>
							)}
						</For>

						<div
							class={cn("atlas-row", "atlas-gap-8")}
							style={{ "margin-top": "18px", "flex-wrap": "wrap" }}
						>
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
