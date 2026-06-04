import { PenLine, RotateCcw, Search } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import {
	AI_USAGE,
	type CategoryId,
	CATEGORY_META,
	DATE_CARDS,
	MAIL_ROWS,
	type NavItem,
	PRIMARY_NAV,
	SCREENER_ITEMS,
	SECONDARY_NAV,
	type ScreenId,
	TASK_CARDS,
} from "./hay-inbox-data";
import { MailList } from "./mail-list";
import { ScreenerScreen } from "./screener-screen";
import { SettingsScreen } from "./settings-screen";
import { TasksScreen } from "./tasks-screen";

/**
 * AppShell — the main Hay application shell for the /dev/hay-inbox demo.
 *
 * Recreates the prototype's desktop-first composition:
 *   - Topbar: HAY wordmark, search / Ask Hay control, Compose control, avatar.
 *   - Sidebar: primary nav (Screener / Inbox / Feed / Paper Trail) + secondary
 *     nav (Tasks & Dates / Settings) with mock counts, plus an AI usage card
 *     and a replay-onboarding affordance.
 *   - Content area: a three-pane category layout (sidebar | list | reading
 *     pane) for Inbox / Feed / Paper Trail, and full-width alternate views for
 *     Screener, Tasks & Dates, and Settings.
 *
 * Navigation, selection, and the active category are local-state only. Thread
 * bodies and Screener routing land in task 3.0; this shell renders the layout,
 * counters, active states, and category-specific panes faithfully.
 */

const CATEGORY_SCREENS: ScreenId[] = ["inbox", "feed", "paper"];

function isCategory(screen: ScreenId): screen is CategoryId {
	return CATEGORY_SCREENS.includes(screen);
}

export const AppShell: Component<{ onReplayOnboarding: () => void }> = (
	props,
) => {
	const [screen, setScreen] = createSignal<ScreenId>("inbox");
	// Per-category selected row, so switching categories preserves selection.
	const [selected, setSelected] = createSignal<
		Record<CategoryId, string | null>
	>({ inbox: null, feed: null, paper: null });

	const rowsFor = (cat: CategoryId) =>
		MAIL_ROWS.filter((r) => r.category === cat);

	const selectRow = (cat: CategoryId, id: string) =>
		setSelected((s) => ({ ...s, [cat]: id }));

	const isWideView = () =>
		screen() === "screener" || screen() === "tasks" || screen() === "settings";

	const NavRow: Component<{ item: NavItem }> = (p) => (
		<button
			type="button"
			class="nav-item"
			classList={{ active: screen() === p.item.id }}
			data-testid={`nav-${p.item.id}`}
			aria-current={screen() === p.item.id ? "page" : undefined}
			onClick={() => setScreen(p.item.id)}
		>
			<span
				class="dot"
				classList={{ [`dot-${p.item.dot}`]: true }}
				aria-hidden="true"
			/>
			<span>{p.item.label}</span>
			<Show when={p.item.count !== undefined}>
				<span class="count tabular">{p.item.count}</span>
			</Show>
		</button>
	);

	return (
		<div
			class="app"
			classList={{ wide: isWideView() }}
			data-testid="hay-shell"
			data-screen={screen()}
		>
			{/* ===== Topbar ===== */}
			<header class="topbar">
				<span class="logo">HAY.</span>
				<button
					type="button"
					class="btn search-control"
					data-testid="search-ask"
				>
					<Search size={16} stroke-width={2.5} />
					<span>Search or ask Hay…</span>
					<span class="kbd">/</span>
				</button>
				<span class="spacer" />
				<button type="button" class="btn primary" data-testid="compose">
					<PenLine size={16} stroke-width={2.5} />
					<span>Compose</span>
				</button>
				<button
					type="button"
					class="avatar avatar-btn"
					data-testid="avatar"
					aria-label="Your account"
				>
					YO
				</button>
			</header>

			{/* ===== Sidebar ===== */}
			<aside class="sidebar" data-testid="sidebar">
				<span class="section-title">Triage</span>
				<For each={PRIMARY_NAV}>{(item) => <NavRow item={item} />}</For>

				<span class="section-title">Workspace</span>
				<For each={SECONDARY_NAV}>{(item) => <NavRow item={item} />}</For>

				<span class="spacer" />

				{/* AI usage card */}
				<div class="ai-usage card" data-testid="ai-usage">
					<div class="ai-usage-head">
						<span>AI usage</span>
						<span class="mono tabular">{AI_USAGE.pct}%</span>
					</div>
					<div
						class="ai-usage-bar"
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={AI_USAGE.limit}
						aria-valuenow={AI_USAGE.used}
						aria-label="AI usage this month"
					>
						<span style={{ width: `${AI_USAGE.pct}%` }} />
					</div>
					<span class="ai-usage-meta mono tabular">
						{AI_USAGE.used.toLocaleString()} / {AI_USAGE.limit.toLocaleString()}{" "}
						credits
					</span>
				</div>

				{/* Replay onboarding affordance */}
				<button
					type="button"
					class="btn ghost replay-shell"
					data-testid="replay-onboarding"
					onClick={() => props.onReplayOnboarding()}
				>
					<RotateCcw size={14} stroke-width={2.5} />
					<span>Replay onboarding</span>
				</button>
			</aside>

			{/* ===== Content ===== */}
			<Show
				when={isWideView()}
				fallback={
					<>
						<Show when={isCategory(screen())}>
							{(_) => {
								const cat = screen() as CategoryId;
								return (
									<MailList
										category={cat}
										rows={rowsFor(cat)}
										selectedId={selected()[cat]}
										onSelect={(id) => selectRow(cat, id)}
									/>
								);
							}}
						</Show>
						<section class="pane" data-testid="reading-pane">
							<Show
								when={
									isCategory(screen()) && selected()[screen() as CategoryId]
								}
								fallback={
									<div class="empty">
										<div class="ic-box" aria-hidden="true">
											✦
										</div>
										<h3>
											{isCategory(screen())
												? CATEGORY_META[screen() as CategoryId].title
												: "Hay"}
										</h3>
										<p>
											Select a message to read it here. Full thread view —
											sender details, AI summary, and extracted tasks — lands
											next.
										</p>
									</div>
								}
							>
								<div class="reading-placeholder">
									<div class="thread-toolbar">
										<span class="mono muted">Thread preview</span>
									</div>
									<div class="thread-body">
										<p class="muted">
											Reading pane for the selected message. The full prototype
											thread view (sender metadata, tags, AI summary, extracted
											tasks &amp; dates, reply controls) is built in task 3.0.
										</p>
									</div>
								</div>
							</Show>
						</section>
					</>
				}
			>
				<Show when={screen() === "screener"}>
					<ScreenerScreen items={SCREENER_ITEMS} />
				</Show>
				<Show when={screen() === "tasks"}>
					<TasksScreen tasks={TASK_CARDS} dates={DATE_CARDS} />
				</Show>
				<Show when={screen() === "settings"}>
					<SettingsScreen
						onReplayOnboarding={() => props.onReplayOnboarding()}
					/>
				</Show>
			</Show>
		</div>
	);
};
