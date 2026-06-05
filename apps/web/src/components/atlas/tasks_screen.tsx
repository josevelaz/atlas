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
import { SAMPLE } from "../../lib/atlas/sample_data";
import { Button } from "../ui/index";
import { AtlasIcon } from "./atlas_icon";
import { DateCard } from "./date_card";
import { TaskCard } from "./task_card";

const TasksScreen: Component = () => {
	const tasks = SAMPLE.tasks;
	const dates = SAMPLE.dates;

	return (
		<div class="atlas-thread" data-screen-label="Tasks & Dates">
			<div class="atlas-thread-toolbar">
				<div>
					<h2 class="atlas-tasks-title">Tasks &amp; Dates</h2>
					<div class="atlas-tasks-subtitle">
						AI-extracted · sync to Google Tasks &amp; Calendar
					</div>
				</div>
				<div class="atlas-row atlas-gap-8">
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

			<div class="atlas-tasks-grid">
				<div class="atlas-tasks-col">
					<h3 class="atlas-tasks-col-head">
						<span class="atlas-badge is-paper is-square">
							<AtlasIcon name="check" size={12} stroke={3} />
							TASKS
						</span>
						<span class="atlas-tasks-col-count">{tasks.length}</span>
					</h3>
					<For each={tasks}>{(task) => <TaskCard task={task} />}</For>
				</div>

				<div class="atlas-tasks-col">
					<h3 class="atlas-tasks-col-head">
						<span class="atlas-badge is-feed is-square">
							<AtlasIcon name="calendar" size={12} />
							DATES
						</span>
						<span class="atlas-tasks-col-count">{dates.length}</span>
					</h3>
					<For each={dates}>{(entry) => <DateCard entry={entry} />}</For>
				</div>
			</div>
		</div>
	);
};

export { TasksScreen };
