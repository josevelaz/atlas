// Atlas — Tasks & Dates screen (full-width workspace region).
//
// Renders the prototype's `TasksScreen`: a thread toolbar (title "Tasks &
// Dates" + AI-extracted subtitle + two sync buttons) over a two-column grid —
// a Tasks column and a Dates column, each headed by a coded badge + count and
// filled with `TaskCard` / `DateCard` rows. Mirrors `docs/prototype/screens.jsx`
// (`TasksScreen`). Content, ordering, counts, and AI-extracted copy come from
// the verbatim `SAMPLE.tasks` / `SAMPLE.dates` fixtures. No runtime imports
// from `docs/prototype/**`.

import type { Component } from "solid-js";
import { For } from "solid-js";
import {
	gap8Classes,
	rowClasses,
	tasksColCountClasses,
	tasksColHeadClasses,
	tasksGridClasses,
	tasksSubtitleClasses,
	tasksTitleClasses,
	threadClasses,
	threadToolbarClasses,
} from "../../lib/atlas/component_classes";
import { SAMPLE } from "../../lib/atlas/sample_data";
import { cn } from "../../lib/utils";
import { Badge, Button } from "../ui/index";
import { AtlasIcon } from "./atlas_icon";
import { DateCard } from "./date_card";
import { TaskCard } from "./task_card";

const TasksScreen: Component = () => {
	const tasks = SAMPLE.tasks;
	const dates = SAMPLE.dates;

	return (
		<div class={threadClasses} data-screen-label="Tasks & Dates">
			<div class={threadToolbarClasses}>
				<div>
					<h2 class={tasksTitleClasses}>Tasks &amp; Dates</h2>
					<div class={tasksSubtitleClasses}>
						AI-extracted · sync to Google Tasks &amp; Calendar
					</div>
				</div>
				<div class={cn(rowClasses, gap8Classes)}>
					<Button size="sm">
						<AtlasIcon name="check" size={12} stroke={3} />
						Sync {tasks.length} tasks
					</Button>
					<Button size="sm" variant="primary">
						<AtlasIcon name="calendar" size={12} />
						Sync {dates.length} dates
					</Button>
				</div>
			</div>

			<div class={tasksGridClasses}>
				<div>
					<h3 class={tasksColHeadClasses}>
						<Badge variant="paper" square class="-rotate-[1.2deg]">
							<AtlasIcon name="check" size={12} stroke={3} />
							TASKS
						</Badge>
						<span class={tasksColCountClasses}>{tasks.length}</span>
					</h3>
					<For each={tasks}>{(task) => <TaskCard task={task} />}</For>
				</div>

				<div>
					<h3 class={tasksColHeadClasses}>
						<Badge variant="feed" square class="-rotate-[1.2deg]">
							<AtlasIcon name="calendar" size={12} />
							DATES
						</Badge>
						<span class={tasksColCountClasses}>{dates.length}</span>
					</h3>
					<For each={dates}>{(entry) => <DateCard entry={entry} />}</For>
				</div>
			</div>
		</div>
	);
};

export { TasksScreen };
