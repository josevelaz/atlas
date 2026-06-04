import {
	Archive,
	CalendarClock,
	CornerUpLeft,
	Ellipsis,
	Forward,
	SquareCheck,
	Trash2,
} from "lucide-solid";
import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import type { MailRow } from "./hay-inbox-data";

/**
 * ThreadView — prototype-faithful reading pane for a selected mail row.
 *
 * Recreates the prototype's `.thread` composition:
 *   - `.thread-toolbar`: subject + sender tags on the left, reply / forward /
 *     archive / delete / more controls on the right.
 *   - `.thread-body`: an `.ai-summary` block (AI head + summary body + the
 *     `.extracted` tasks/dates list) followed by the `.message` stack, each
 *     message carrying sender name, address, and a mono date.
 *
 * All controls are local/visual only — no mail is sent, archived, or deleted.
 * Selection is owned by the parent shell; this component is a pure render of
 * the selected row's `thread` detail.
 */
export const ThreadView: Component<{
	row: MailRow;
	/** Opens the Compose overlay as a reply (local/demo-only). */
	onReply?: () => void;
}> = (props) => {
	return (
		<div class="thread" data-testid={`thread-view-${props.row.id}`}>
			{/* ===== Toolbar ===== */}
			<div class="thread-toolbar">
				<div class="col" style={{ "min-width": "0", gap: "4px" }}>
					<span class="thread-subject">{props.row.subject}</span>
					<Show when={props.row.tags && props.row.tags.length > 0}>
						<div class="row-tags">
							<For each={props.row.tags}>
								{(tag) => (
									<span
										class="tag"
										classList={{ [`solid-${tag.variant}`]: !!tag.variant }}
									>
										{tag.label}
									</span>
								)}
							</For>
						</div>
					</Show>
				</div>
				<div class="thread-actions" role="toolbar" aria-label="Thread actions">
					<button
						type="button"
						class="thread-act primary"
						data-testid="thread-reply"
						aria-label="Reply"
						onClick={() => props.onReply?.()}
					>
						<CornerUpLeft size={15} stroke-width={2.5} />
						<span>Reply</span>
					</button>
					<button
						type="button"
						class="thread-act"
						data-testid="thread-forward"
						aria-label="Forward"
					>
						<Forward size={15} stroke-width={2.5} />
					</button>
					<button
						type="button"
						class="thread-act"
						data-testid="thread-archive"
						aria-label="Archive"
					>
						<Archive size={15} stroke-width={2.5} />
					</button>
					<button
						type="button"
						class="thread-act"
						data-testid="thread-delete"
						aria-label="Delete"
					>
						<Trash2 size={15} stroke-width={2.5} />
					</button>
					<button
						type="button"
						class="thread-act"
						data-testid="thread-more"
						aria-label="More actions"
					>
						<Ellipsis size={15} stroke-width={2.5} />
					</button>
				</div>
			</div>

			{/* ===== Body ===== */}
			<div class="thread-body">
				{/* AI summary + extracted tasks/dates */}
				<div class="ai-summary" data-testid="ai-summary">
					<div class="head">AI summary</div>
					<div class="body">{props.row.thread.aiSummary}</div>
					<Show when={props.row.thread.extracted.length > 0}>
						<div class="extracted" data-testid="ai-extracted">
							<For each={props.row.thread.extracted}>
								{(item) => (
									<div class="extract-item" data-testid={`extract-${item.id}`}>
										<span
											class="ic"
											classList={{
												task: item.kind === "task",
												date: item.kind === "date",
											}}
											aria-hidden="true"
										>
											<Show
												when={item.kind === "task"}
												fallback={
													<CalendarClock size={13} stroke-width={2.5} />
												}
											>
												<SquareCheck size={13} stroke-width={2.5} />
											</Show>
										</span>
										<span>{item.label}</span>
										<span class="mono">{item.meta}</span>
									</div>
								)}
							</For>
						</div>
					</Show>
				</div>

				{/* Message stack */}
				<For each={props.row.thread.messages}>
					{(msg) => (
						<div class="message" data-testid={`message-${msg.id}`}>
							<div class="message-head">
								<span class="avatar sm" aria-hidden="true">
									{msg.initials}
								</span>
								<div class="who col" style={{ "min-width": "0" }}>
									<span class="name">{msg.from}</span>
									<span class="addr">{msg.address}</span>
								</div>
								<span class="date">{msg.date}</span>
							</div>
							<div class="message-body">
								<For each={msg.body}>{(para) => <p>{para}</p>}</For>
							</div>
						</div>
					)}
				</For>
			</div>
		</div>
	);
};
