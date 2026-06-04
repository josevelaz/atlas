import { CalendarClock, SquareCheck } from "lucide-solid";
import type { Component } from "solid-js";
import { For } from "solid-js";
import type { DateCard, TaskCard } from "./hay-inbox-data";

/**
 * TasksScreen — full-width Tasks & Dates surface (prototype alternate view).
 *
 * Two columns: tasks extracted from mail (with priority badges + source line)
 * and dates extracted from mail (with a mono "when" and source line). All
 * content is mock and read-only for this phase.
 */
export const TasksScreen: Component<{
	tasks: TaskCard[];
	dates: DateCard[];
}> = (props) => {
	return (
		<div class="pane" data-testid="tasks-screen">
			<div class="list-header">
				<div class="col">
					<h2>Tasks &amp; Dates</h2>
					<span class="meta">Extracted from your mail by Hay</span>
				</div>
				<span class="meta tabular">
					{props.tasks.length} tasks · {props.dates.length} dates
				</span>
			</div>

			<div class="tasks-grid">
				<div class="tasks-col">
					<h3>
						<SquareCheck size={18} stroke-width={2.5} /> Tasks
					</h3>
					<For each={props.tasks}>
						{(task) => (
							<div class="task-card" data-testid={`task-card-${task.id}`}>
								<div class="row gap-8" style={{ "align-items": "flex-start" }}>
									<span
										class="priority"
										classList={{ [task.priority ?? "p3"]: true }}
									>
										{task.priority ?? "p3"}
									</span>
									<span style={{ "font-weight": "700" }}>{task.title}</span>
								</div>
								<div class="src">{task.source}</div>
							</div>
						)}
					</For>
				</div>

				<div class="tasks-col">
					<h3>
						<CalendarClock size={18} stroke-width={2.5} /> Dates
					</h3>
					<For each={props.dates}>
						{(date) => (
							<div class="task-card" data-testid={`date-card-${date.id}`}>
								<div class="col gap-4">
									<span style={{ "font-weight": "700" }}>{date.title}</span>
									<span class="mono" style={{ "font-size": "12px" }}>
										{date.when}
									</span>
								</div>
								<div class="src">{date.source}</div>
							</div>
						)}
					</For>
				</div>
			</div>
		</div>
	);
};
