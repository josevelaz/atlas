// Atlas — AI summary block.
//
// Electric-blue header (the AI's signature voice) over a white summary body and
// an "EXTRACTED" panel of AI-surfaced tasks (mint tile) and dates (yellow tile),
// plus confirm / add-to-calendar actions. Mirrors the prototype's `.ai-summary`.

import type { Component } from "solid-js";
import { For } from "solid-js";
import type { ExtractedItem, ThreadBody } from "../../lib/atlas/types";
import { Button } from "../ui/index";
import { AtlasIcon } from "./atlas_icon";

export interface AiSummaryProps {
	body: ThreadBody;
}

function ExtractRow(props: { item: ExtractedItem }) {
	const isTask = () => props.item.kind === "task";
	return (
		<div class="atlas-extract-item">
			<span class={`atlas-extract-ic ${isTask() ? "is-task" : "is-date"}`}>
				<AtlasIcon
					name={isTask() ? "check" : "calendar"}
					size={12}
					stroke={isTask() ? 3 : 2.5}
				/>
			</span>
			<span>{props.item.label}</span>
			<span class="atlas-extract-due">{props.item.due}</span>
		</div>
	);
}

const AiSummary: Component<AiSummaryProps> = (props) => {
	const body = () => props.body;
	const counts = () => {
		const msgs = body().messages.length;
		const tasks = body().tasks.length;
		const dates = body().dates.length;
		return `${msgs} messages · ${tasks} tasks · ${dates} date${
			dates === 1 ? "" : "s"
		}`;
	};

	return (
		<div class="atlas-ai-summary">
			<div class="atlas-ai-head">
				<AtlasIcon name="sparkle" size={14} color="#fff" stroke={2.5} />
				AI summary
				<span class="atlas-ai-meta">{counts()}</span>
			</div>
			<div class="atlas-ai-text">{body().aiSummary}</div>
			<div class="atlas-extracted">
				<div class="atlas-extracted-label">EXTRACTED</div>
				<For each={body().tasks}>{(item) => <ExtractRow item={item} />}</For>
				<For each={body().dates}>{(item) => <ExtractRow item={item} />}</For>
				<div class="atlas-row atlas-gap-8" style={{ "margin-top": "4px" }}>
					<Button variant="primary" size="sm">
						<AtlasIcon name="check" size={12} stroke={3} /> Confirm{" "}
						{body().tasks.length} tasks
					</Button>
					<Button size="sm">
						<AtlasIcon name="calendar" size={12} /> Add to Google Calendar
					</Button>
				</div>
			</div>
		</div>
	);
};

export { AiSummary };
