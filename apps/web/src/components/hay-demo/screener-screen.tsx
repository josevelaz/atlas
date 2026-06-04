import { ShieldCheck } from "lucide-solid";
import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import type { ScreenerItem } from "./hay-inbox-data";

/**
 * ScreenerScreen — full-width Screener surface (prototype alternate view).
 *
 * First-time senders queue here for triage. Each `.screener-card` shows the
 * sender, address, a faded preview, the AI's suggested destination, and
 * Accept / Reject actions. Accept routes the sender's future mail into the
 * suggested category; Reject drops them from review.
 *
 * Task 2.0 scope renders the layout, counters, and active state. The accept/
 * reject routing into local category lists is finalized in task 3.0; the
 * handlers are surfaced here so the shell can wire them when that lands.
 */
export const ScreenerScreen: Component<{
	items: ScreenerItem[];
	onAccept?: (id: string) => void;
	onReject?: (id: string) => void;
}> = (props) => {
	return (
		<div class="pane screener-pane" data-testid="screener-screen">
			<div class="list-header">
				<div class="col">
					<h2>Screener</h2>
					<span class="meta">First-time senders waiting on your call</span>
				</div>
				<span class="meta tabular">{props.items.length} pending</span>
			</div>

			<div class="screener-scroll">
				<Show
					when={props.items.length > 0}
					fallback={
						<div class="empty">
							<div class="ic-box" aria-hidden="true">
								<ShieldCheck size={32} stroke-width={2.5} />
							</div>
							<h3>Screener clear</h3>
							<p>
								No one's waiting. New senders will land here for a quick
								accept-or-reject.
							</p>
						</div>
					}
				>
					<div class="screener-stack">
						<For each={props.items}>
							{(item) => (
								<div
									class="screener-card"
									data-testid={`screener-card-${item.id}`}
								>
									<div class="screener-head">
										<span class="avatar lg" aria-hidden="true">
											{item.initials}
										</span>
										<div class="col" style={{ "min-width": "0" }}>
											<span class="name">{item.from}</span>
											<span class="addr">{item.address}</span>
										</div>
									</div>
									<div class="screener-preview">{item.preview}</div>
									<div class="screener-ai">
										<span class="pill">AI</span>
										<span>{item.suggestedLabel}</span>
									</div>
									<div class="screener-actions">
										<button
											type="button"
											class="accept"
											data-testid={`screener-accept-${item.id}`}
											onClick={() => props.onAccept?.(item.id)}
										>
											Accept
										</button>
										<button
											type="button"
											class="reject"
											data-testid={`screener-reject-${item.id}`}
											onClick={() => props.onReject?.(item.id)}
										>
											Reject
										</button>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>
			</div>
		</div>
	);
};
