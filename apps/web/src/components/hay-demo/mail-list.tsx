import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { CATEGORY_META, type CategoryId, type MailRow } from "./hay-inbox-data";

/**
 * MailList — reusable category list rail for Inbox, Feed, and Paper Trail.
 *
 * Renders the prototype's `.list` column: a `.list-header` (category title +
 * mono meta/count) over a scrollable stack of `.mail-row`s. Rows show an
 * avatar, sender, subject, preview, mono timestamp, optional tags, an unread
 * dot, and a selected state.
 *
 * Selection is driven by the parent via `selectedId` / `onSelect` so the
 * reading pane stays in sync (full thread bodies land in task 3.0; task 2.0
 * wires the list, header, counts, and selected-row visuals).
 */
export const MailList: Component<{
	category: CategoryId;
	rows: MailRow[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}> = (props) => {
	const meta = () => CATEGORY_META[props.category];
	const unreadCount = () => props.rows.filter((r) => r.unread).length;

	return (
		<div class="list" data-testid={`mail-list-${props.category}`}>
			<div class="list-header">
				<div class="col">
					<h2>{meta().title}</h2>
					<span class="meta">{meta().meta}</span>
				</div>
				<span class="meta tabular">
					{unreadCount()} unread · {props.rows.length} total
				</span>
			</div>

			<div class="list-scroll">
				<Show
					when={props.rows.length > 0}
					fallback={
						<div class="empty">
							<div class="ic-box" aria-hidden="true">
								✦
							</div>
							<h3>Nothing here yet</h3>
							<p>New mail routed to this category will show up here.</p>
						</div>
					}
				>
					<For each={props.rows}>
						{(row) => (
							<button
								type="button"
								class="mail-row"
								classList={{
									unread: row.unread,
									selected: props.selectedId === row.id,
								}}
								data-testid={`mail-row-${row.id}`}
								onClick={() => props.onSelect(row.id)}
							>
								<span class="avatar sm" aria-hidden="true">
									{row.initials}
								</span>
								<div class="col" style={{ "min-width": "0" }}>
									<span class="from">{row.from}</span>
									<span class="subj">{row.subject}</span>
									<span class="preview">{row.preview}</span>
									<Show when={row.tags && row.tags.length > 0}>
										<div class="row-tags">
											<For each={row.tags}>
												{(tag) => (
													<span
														class="tag"
														classList={{
															[`solid-${tag.variant}`]: !!tag.variant,
														}}
													>
														{tag.label}
													</span>
												)}
											</For>
										</div>
									</Show>
								</div>
								<span class="meta-text">{row.time}</span>
							</button>
						)}
					</For>
				</Show>
			</div>
		</div>
	);
};
