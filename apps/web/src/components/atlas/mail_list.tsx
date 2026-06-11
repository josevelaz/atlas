// Atlas — mail list column.
//
// Header (title + count) → optional AI banner → scrollable rows. Mirrors the
// prototype's `MailList`: an empty state renders when the list has no rows.

import type { Component, JSX } from "solid-js";
import { For, Show } from "solid-js";
import {
	gap8Classes,
	listHeaderClasses,
	listHeaderTitleClasses,
	listMetaClasses,
	listScrollClasses,
	rowClasses,
} from "../../lib/atlas/component_classes";
import type { MailItem } from "../../lib/atlas/types";
import { cn } from "../../lib/utils";
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
			<div class={listHeaderClasses}>
				<h2 class={listHeaderTitleClasses}>{props.title}</h2>
				<div class={cn(rowClasses, gap8Classes)}>
					<span class={listMetaClasses}>{props.items.length}</span>
				</div>
			</div>
			{props.aiBanner}
			<div class={listScrollClasses}>
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
