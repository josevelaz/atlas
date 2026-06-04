import { Sparkles } from "lucide-solid";
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
	// Inbox-only AI nudge banner (prototype parity): count P1 unread threads.
	const p1Count = () =>
		props.rows.filter((r) => r.unread && r.priority === "p1").length;

	return (
		<div class="list" data-testid={`mail-list-${props.category}`}>
			<div class="list-header">
				<h2>{meta().title}</h2>
				<span class="meta tabular">{props.rows.length}</span>
			</div>

			{/* Inbox AI banner — surfaces priority threads needing a reply. */}
			<Show when={props.category === "inbox" && p1Count() > 0}>
				<div class="ai-banner" data-testid="inbox-ai-banner">
					<Sparkles size={12} stroke-width={2.5} />
					<span>
						{p1Count()} P1 thread{p1Count() === 1 ? "" : "s"} need
						{p1Count() === 1 ? "s" : ""} a reply today.
					</span>
					<span class="spacer" />
					<button type="button" class="ai-banner-action">
						Sort by priority
					</button>
				</div>
			</Show>

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
									<Show
										when={row.priority || (row.tags && row.tags.length > 0)}
									>
										<div class="row-tags">
											<Show when={row.priority}>
												<span
													class="priority"
													classList={{ [`${row.priority}`]: true }}
												>
													{row.priority?.toUpperCase()}
												</span>
											</Show>
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
