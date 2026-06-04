import {
	Archive,
	CalendarClock,
	CalendarPlus,
	CheckCheck,
	ChevronDown,
	ChevronUp,
	Clock,
	CornerUpLeft,
	Forward,
	Inbox,
	ReplyAll,
	SquareCheck,
	Trash2,
} from "lucide-solid";
import type { Component } from "solid-js";
import { createMemo, For, Show } from "solid-js";
import type { MailRow } from "./hay-inbox-data";

/**
 * ThreadView — prototype-faithful reading pane for a selected mail row.
 *
 * Recreates the prototype's `.thread` composition:
 *   - `.thread-toolbar`: a left action group (Archive · Trash · divider · Set
 *     aside · Reply later) and a right pager group (prev / next chevrons). Set
 *     aside and Reply later are toggles that flip to the primary (accent) state
 *     when active, exactly like the prototype.
 *   - `.thread-body`: the subject heading + priority/tags row, an `.ai-summary`
 *     block (AI head + meta count + summary body + the `.extracted` tasks/dates
 *     list and Confirm/Add affordances), the `.message` stack, and a trailing
 *     Reply / Reply all / Forward action row.
 *
 * All controls are local/visual only — no mail is sent, archived, or deleted.
 * Set aside / Reply later toggle state is owned by the parent shell (keyed by
 * row id) so it persists across re-selection.
 */
export const ThreadView: Component<{
	row: MailRow;
	/** Opens the Compose overlay as a reply (local/demo-only). */
	onReply?: () => void;
	/** Whether this thread is currently "set aside" (local/demo-only). */
	setAside?: boolean;
	/** Whether this thread is flagged "reply later" (local/demo-only). */
	replyLater?: boolean;
	/** Toggle the set-aside state for this thread. */
	onToggleSetAside?: () => void;
	/** Toggle the reply-later state for this thread. */
	onToggleReplyLater?: () => void;
}> = (props) => {
	const taskCount = createMemo(
		() => props.row.thread.extracted.filter((e) => e.kind === "task").length,
	);
	const dateCount = createMemo(
		() => props.row.thread.extracted.filter((e) => e.kind === "date").length,
	);
	const messageCount = () => props.row.thread.messages.length;

	// Compact "N messages · N tasks · N date(s)" meta line (prototype parity).
	const summaryMeta = createMemo(() => {
		const parts: string[] = [
			`${messageCount()} message${messageCount() === 1 ? "" : "s"}`,
		];
		if (taskCount() > 0)
			parts.push(`${taskCount()} task${taskCount() === 1 ? "" : "s"}`);
		if (dateCount() > 0)
			parts.push(`${dateCount()} date${dateCount() === 1 ? "" : "s"}`);
		return parts.join(" · ");
	});

	return (
		<div class="thread" data-testid={`thread-view-${props.row.id}`}>
			{/* ===== Toolbar ===== */}
			<div class="thread-toolbar" role="toolbar" aria-label="Thread actions">
				<div class="row gap-8">
					<button type="button" class="btn sm" data-testid="thread-archive">
						<Archive size={14} stroke-width={2.5} />
						<span>Archive</span>
					</button>
					<button type="button" class="btn sm" data-testid="thread-trash">
						<Trash2 size={14} stroke-width={2.5} />
						<span>Trash</span>
					</button>
					<span class="thread-toolbar-divider" aria-hidden="true" />
					<button
						type="button"
						class="btn sm"
						classList={{ primary: props.setAside }}
						data-testid="thread-set-aside"
						aria-pressed={props.setAside ? "true" : "false"}
						onClick={() => props.onToggleSetAside?.()}
					>
						<Clock size={14} stroke-width={2.5} />
						<span>Set aside</span>
					</button>
					<button
						type="button"
						class="btn sm"
						classList={{ primary: props.replyLater }}
						data-testid="thread-reply-later"
						aria-pressed={props.replyLater ? "true" : "false"}
						onClick={() => props.onToggleReplyLater?.()}
					>
						<CornerUpLeft size={14} stroke-width={2.5} />
						<span>Reply later</span>
					</button>
				</div>
				<div class="row gap-8">
					<button
						type="button"
						class="btn sm icon"
						data-testid="thread-prev"
						aria-label="Previous thread"
					>
						<ChevronUp size={14} stroke-width={2.5} />
					</button>
					<button
						type="button"
						class="btn sm icon"
						data-testid="thread-next"
						aria-label="Next thread"
					>
						<ChevronDown size={14} stroke-width={2.5} />
					</button>
				</div>
			</div>

			{/* ===== Body ===== */}
			<div class="thread-body">
				{/* Subject heading + priority / tags */}
				<div class="thread-heading">
					<h2 class="thread-subject">{props.row.subject}</h2>
					<div class="row gap-8 row-tags">
						<Show when={props.row.priority}>
							<span
								class="priority"
								classList={{ [`${props.row.priority}`]: true }}
							>
								{props.row.priority?.toUpperCase()} priority
							</span>
						</Show>
						<span class="tag">
							<Inbox size={11} stroke-width={2.5} /> Inbox
						</span>
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
				</div>

				{/* AI summary + extracted tasks/dates */}
				<div class="ai-summary" data-testid="ai-summary">
					<div class="head">
						<span>AI summary</span>
						<span class="ai-summary-meta">{summaryMeta()}</span>
					</div>
					<div class="body">{props.row.thread.aiSummary}</div>
					<Show when={props.row.thread.extracted.length > 0}>
						<div class="extracted" data-testid="ai-extracted">
							<span class="extracted-label">Extracted</span>
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
							<div class="row gap-8 extracted-actions">
								<Show when={taskCount() > 0}>
									<button type="button" class="btn sm primary">
										<CheckCheck size={12} stroke-width={3} />
										<span>
											Confirm {taskCount()} task{taskCount() === 1 ? "" : "s"}
										</span>
									</button>
								</Show>
								<Show when={dateCount() > 0}>
									<button type="button" class="btn sm">
										<CalendarPlus size={12} stroke-width={2.5} />
										<span>Add to Google Calendar</span>
									</button>
								</Show>
							</div>
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

				{/* Trailing reply action row */}
				<div class="row gap-8 thread-reply-row">
					<button
						type="button"
						class="btn primary"
						data-testid="thread-reply"
						onClick={() => props.onReply?.()}
					>
						<CornerUpLeft size={14} stroke-width={2.5} />
						<span>Reply</span>
					</button>
					<button type="button" class="btn" data-testid="thread-reply-all">
						<ReplyAll size={14} stroke-width={2.5} />
						<span>Reply all</span>
					</button>
					<button type="button" class="btn" data-testid="thread-forward">
						<Forward size={14} stroke-width={2.5} />
						<span>Forward</span>
					</button>
				</div>
			</div>
		</div>
	);
};
