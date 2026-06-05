// Atlas — mail list column.
//
// Header (title + count) → optional AI banner → scrollable rows. Mirrors the
// prototype's `MailList`: an empty state renders when the list has no rows.

import type { Component, JSX } from "solid-js";
import { For, Show } from "solid-js";
import type { MailItem } from "../../lib/atlas/types";
import { EmptyState } from "./empty_state";
import { MailRow } from "./mail_row";

export interface MailListProps {
	title: string;
	items: MailItem[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	/** Optional AI banner rendered under the header (inbox only). */
	aiBanner?: JSX.Element;
}

const MailList: Component<MailListProps> = (props) => {
	return (
		<>
			<div class="atlas-list-header">
				<h2>{props.title}</h2>
				<div class="atlas-row atlas-gap-8">
					<span class="atlas-meta">{props.items.length}</span>
				</div>
			</div>
			{props.aiBanner}
			<div class="atlas-list-scroll">
				<Show
					when={props.items.length > 0}
					fallback={
						<EmptyState
							icon="inbox"
							heading="Nothing here yet"
							body="New mail you've accepted will appear here."
						/>
					}
				>
					<For each={props.items}>
						{(mail) => (
							<MailRow
								mail={mail}
								selected={props.selectedId === mail.id}
								onSelect={props.onSelect}
							/>
						)}
					</For>
				</Show>
			</div>
		</>
	);
};

export { MailList };
