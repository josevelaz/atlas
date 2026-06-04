import { CalendarClock, SquareCheck } from "lucide-solid";
import type { Component } from "solid-js";
import { For } from "solid-js";
import type { DateCard, TaskCard } from "./hay-inbox-data";

/**
 * TasksScreen — full-width Tasks & Dates surface (prototype alternate view).
 *
 * Recreates the prototype's two-column composition:
 *   - A `.thread-toolbar` header with the title, an AI-extracted subline, and
 *     local-only "Sync tasks / Sync dates" buttons.
 *   - Left column: tasks, each `.task-card` with a checkbox tile, title,
 *     mono "Due:" line, and a "From:" source attribution.
 *   - Right column: dates, each `.task-card` with a month/day date tile, title,
 *     mono "when" line, and a "From:" source attribution.
 *
 * All content is mock/local and read-only — nothing syncs anywhere.
 */

/** Derive a compact month abbreviation + day number from a "when" string. */
function dateTile(when: string): { mon: string; day: string } {
	const mon = when.match(/[A-Z][a-z]{2}/)?.[0]?.toUpperCase() ?? "—";
	const day = when.match(/\b(\d{1,2})\b/)?.[0] ?? "?";
	return { mon, day };
}

export const TasksScreen: Component<{
	tasks: TaskCard[];
	dates: DateCard[];
}> = (props) => {
	return (
		<div class="thread tasks-screen" data-testid="tasks-screen">
			<div class="thread-toolbar">
				<div class="col" style={{ gap: "2px" }}>
					<h2 class="thread-subject">Tasks &amp; Dates</h2>
					<span class="mono meta">AI-extracted from your synced mail</span>
				</div>
				<div class="thread-actions">
					<button type="button" class="thread-act" data-testid="sync-tasks">
						<SquareCheck size={14} stroke-width={3} />
						<span>Sync {props.tasks.length} tasks</span>
					</button>
					<button
						type="button"
						class="thread-act primary"
						data-testid="sync-dates"
					>
						<CalendarClock size={14} stroke-width={2.5} />
						<span>Sync {props.dates.length} dates</span>
					</button>
				</div>
			</div>

			<div class="tasks-grid">
				{/* ===== Tasks column ===== */}
				<div class="tasks-col">
					<h3>
						<span class="badge solid-paper sq">
							<SquareCheck size={12} stroke-width={3} /> Tasks
						</span>
						<span class="mono count-label">{props.tasks.length}</span>
					</h3>
					<For each={props.tasks}>
						{(task) => (
							<div class="task-card" data-testid={`task-card-${task.id}`}>
								<div class="task-main">
									<span class="task-check" aria-hidden="true" />
									<div class="col" style={{ flex: "1", "min-width": "0" }}>
										<span class="task-title">{task.title}</span>
										<span class="mono task-due">Due: {task.due}</span>
									</div>
									<span
										class="priority"
										classList={{ [task.priority ?? "p3"]: true }}
									>
										{task.priority ?? "p3"}
									</span>
								</div>
								<div class="src">From: {task.source}</div>
							</div>
						)}
					</For>
				</div>

				{/* ===== Dates column ===== */}
				<div class="tasks-col">
					<h3>
						<span class="badge solid-feed sq">
							<CalendarClock size={12} stroke-width={2.5} /> Dates
						</span>
						<span class="mono count-label">{props.dates.length}</span>
					</h3>
					<For each={props.dates}>
						{(date) => {
							const tile = dateTile(date.when);
							return (
								<div class="task-card" data-testid={`date-card-${date.id}`}>
									<div class="task-main">
										<span class="date-tile" aria-hidden="true">
											<span class="date-mon">{tile.mon}</span>
											<span class="date-day">{tile.day}</span>
										</span>
										<div class="col" style={{ flex: "1", "min-width": "0" }}>
											<span class="task-title">{date.title}</span>
											<span class="mono task-due">{date.when}</span>
										</div>
									</div>
									<div class="src">From: {date.source}</div>
								</div>
							);
						}}
					</For>
				</div>
			</div>
		</div>
	);
};
