// Atlas — task card (Tasks column of the Tasks & Dates screen).
//
// A single AI-extracted task: a square checkbox, the task label, a "Due: …"
// line, and a dashed-rule source footer ("From: <provenance>"). Mirrors the
// prototype's `.task-card` in `docs/prototype/screens.jsx` (TasksScreen, tasks
// column). Content (label, due, source) is preserved verbatim from the sample
// fixtures. No runtime imports from `docs/prototype/**`.

import type { Component } from "solid-js";
import {
	taskCardClasses,
	taskCheckClasses,
	taskDueClasses,
	taskLabelClasses,
	taskMainClasses,
	taskRowClasses,
	taskSrcClasses,
} from "../../lib/atlas/component_classes";
import type { TaskEntry } from "../../lib/atlas/types";

export interface TaskCardProps {
	task: TaskEntry;
}

const TaskCard: Component<TaskCardProps> = (props) => {
	return (
		<div class={taskCardClasses} data-task-id={props.task.id}>
			<div class={taskRowClasses}>
				<span class={taskCheckClasses} aria-hidden="true" />
				<div class={taskMainClasses}>
					<div class={taskLabelClasses}>{props.task.label}</div>
					<div class={taskDueClasses}>Due: {props.task.due}</div>
				</div>
			</div>
			<div class={taskSrcClasses}>From: {props.task.source}</div>
		</div>
	);
};

export { TaskCard };
