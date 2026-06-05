// Atlas — date card (Dates column of the Tasks & Dates screen).
//
// A single AI-extracted calendar date: a coded "feed"-yellow calendar tile
// stamped with a month abbreviation + day number, the date label, the full due
// descriptor, and a dashed-rule source footer ("From: <provenance>"). Mirrors
// the prototype's date `.task-card` in `docs/prototype/screens.jsx`
// (TasksScreen, dates column). The tile month/day are derived from the `due`
// string with the exact same regexes the prototype uses, so the stamped value
// matches byte-for-byte. No runtime imports from `docs/prototype/**`.

import type { Component } from "solid-js";
import type { DateEntry } from "../../lib/atlas/types";

/** Month abbreviation stamped on the tile (e.g. "FRI"/"WED"; "—" if none). */
function tileMonth(due: string): string {
	return (due.match(/[A-Z][a-z]{2}/) ?? ["—"])[0].toUpperCase();
}

/** Day number stamped on the tile (first 1–2 digit run; "?" if none). */
function tileDay(due: string): string {
	return (due.match(/\d{1,2}/) ?? ["?"])[0];
}

export interface DateCardProps {
	entry: DateEntry;
}

const DateCard: Component<DateCardProps> = (props) => {
	return (
		<div class="atlas-task-card" data-date-id={props.entry.id}>
			<div class="atlas-task-row">
				<span class="atlas-date-tile" aria-hidden="true">
					<span class="atlas-date-tile-month">
						{tileMonth(props.entry.due)}
					</span>
					<span class="atlas-date-tile-day">{tileDay(props.entry.due)}</span>
				</span>
				<div class="atlas-task-main">
					<div class="atlas-task-label">{props.entry.label}</div>
					<div class="atlas-task-due">{props.entry.due}</div>
				</div>
			</div>
			<div class="atlas-task-src">From: {props.entry.source}</div>
		</div>
	);
};

export { DateCard };
