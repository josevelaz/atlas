import { PenLine, RotateCcw, Search } from "lucide-solid";
import type { Component } from "solid-js";
import {
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { AssistantOverlay } from "./assistant-overlay";
import { ComposeOverlay } from "./compose-overlay";
import {
	AI_USAGE,
	CATEGORY_META,
	type CategoryId,
	categoryForThread,
	DATE_CARDS,
	MAIL_ROWS,
	type MailRow,
	type NavItem,
	PRIMARY_NAV,
	SCREENER_ITEMS,
	type ScreenerItem,
	type ScreenId,
	SECONDARY_NAV,
	screenerItemToMailRow,
	TASK_CARDS,
} from "./hay-inbox-data";
import { MailList } from "./mail-list";
import { ScreenerScreen } from "./screener-screen";
import { SettingsScreen } from "./settings-screen";
import { TasksScreen } from "./tasks-screen";
import { ThreadView } from "./thread-view";

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
	// Inbox defaults to the Priya thread (i1), matching the prototype's
	// initial `selected: { inbox: "i1" }` so the reading pane opens populated.
	const [selected, setSelected] = createSignal<
		Record<CategoryId, string | null>
	>({ inbox: "i1", feed: null, paper: null });

	// Mail rows live in local state so accepted Screener senders can be routed
	// into their suggested category list at runtime.
	const [rows, setRows] = createSignal<MailRow[]>(MAIL_ROWS);
	// Screener queue is local state so accept/reject can mutate it.
	const [screenerItems, setScreenerItems] =
		createSignal<ScreenerItem[]>(SCREENER_ITEMS);

	const rowsFor = (cat: CategoryId) => rows().filter((r) => r.category === cat);

	const selectRow = (cat: CategoryId, id: string) =>
		setSelected((s) => ({ ...s, [cat]: id }));

	// Active category for the three-pane category view. Null on wide views.
	const activeCategory = createMemo<CategoryId | null>(() => {
		const s = screen();
		return isCategory(s) ? s : null;
	});

	const selectedRow = createMemo<MailRow | null>(() => {
		const cat = activeCategory();
		if (!cat) return null;
		const id = selected()[cat];
		if (!id) return null;
		return rows().find((r) => r.id === id) ?? null;
	});

	// Accept: route the sender into their suggested category list, then drop
	// them from the pending Screener queue.
	const acceptScreener = (id: string) => {
		const item = screenerItems().find((i) => i.id === id);
		if (!item) return;
		setRows((prev) => [screenerItemToMailRow(item), ...prev]);
		setScreenerItems((prev) => prev.filter((i) => i.id !== id));
	};

	// Reject: drop the sender from the pending Screener queue (no routing).
	const rejectScreener = (id: string) =>
		setScreenerItems((prev) => prev.filter((i) => i.id !== id));

	const isWideView = () =>
		screen() === "screener" || screen() === "tasks" || screen() === "settings";

	// ===== Overlays (Compose + Ask Hay) — local/demo-only visibility =====
	const [composeOpen, setComposeOpen] = createSignal(false);
	const [replyTo, setReplyTo] = createSignal<string | undefined>(undefined);
	const [assistantOpen, setAssistantOpen] = createSignal(false);

	// Open the Compose overlay as a reply to the selected thread's sender.
	const replyToSelected = () => {
		setReplyTo(selectedRow()?.address);
		setComposeOpen(true);
	};

	// Open a cited thread from the assistant: route to its category and select
	// it so the reading pane shows the thread. Screener citations (e.g. Maya
	// Chen, "s1") route to the Screener surface. No-op if the id is unknown.
	const openThread = (threadId: string) => {
		const cat = categoryForThread(threadId);
		if (cat) {
			setScreen(cat);
			selectRow(cat, threadId);
			return;
		}
		if (screenerItems().some((i) => i.id === threadId)) {
			setScreen("screener");
		}
	};

	// ===== Prototype keyboard shortcuts (scoped to the demo shell) =====
	// 1–4 jump to surfaces, c opens Compose, / or ⌘/Ctrl-K opens Ask Hay,
	// Escape closes any open overlay. Typing in inputs/textareas is ignored.
	onMount(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") {
				if (e.key === "Escape") {
					setAssistantOpen(false);
					setComposeOpen(false);
				}
				return;
			}
			if (e.metaKey || e.ctrlKey) {
				if (e.key.toLowerCase() === "k") {
					e.preventDefault();
					setAssistantOpen(true);
				}
				return;
			}
			if (e.key === "1") setScreen("screener");
			else if (e.key === "2") setScreen("inbox");
			else if (e.key === "3") setScreen("feed");
			else if (e.key === "4") setScreen("paper");
			else if (e.key === "c" || e.key === "C") {
				setReplyTo(undefined);
				setComposeOpen(true);
			} else if (e.key === "/") {
				e.preventDefault();
				setAssistantOpen(true);
			} else if (e.key === "Escape") {
				setAssistantOpen(false);
				setComposeOpen(false);
			}
		};
		window.addEventListener("keydown", onKey);
		onCleanup(() => window.removeEventListener("keydown", onKey));
	});

	// Live nav counts, matching the prototype's derived rail: Screener = pending
	// senders, Inbox/Feed = unread counts, Paper Trail = total, Tasks = fixed 5.
	// These update reactively as the Screener queue / category lists change.
	const navCount = (id: ScreenId): number | undefined => {
		switch (id) {
			case "screener":
				return screenerItems().length;
			case "inbox":
				return rowsFor("inbox").filter((r) => r.unread).length;
			case "feed":
				return rowsFor("feed").filter((r) => r.unread).length;
			case "paper":
				return rowsFor("paper").length;
			default:
				return PRIMARY_NAV.concat(SECONDARY_NAV).find((n) => n.id === id)
					?.count;
		}
	};

	const NavRow: Component<{ item: NavItem }> = (p) => {
		const count = () => navCount(p.item.id);
		return (
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
				<Show when={count() !== undefined && (count() as number) > 0}>
					<span class="count tabular">{count()}</span>
				</Show>
			</button>
		);
	};

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
					onClick={() => setAssistantOpen(true)}
				>
					<Search size={16} stroke-width={2.5} />
					<span>Search or ask Hay…</span>
					<span class="kbd">/</span>
				</button>
				<span class="spacer" />
				<button
					type="button"
					class="btn primary"
					data-testid="compose"
					onClick={() => {
						setReplyTo(undefined);
						setComposeOpen(true);
					}}
				>
					<PenLine size={16} stroke-width={2.5} />
					<span>Compose</span>
				</button>
				<button
					type="button"
					class="avatar avatar-btn"
					data-testid="avatar"
					aria-label="Your account"
				>
					RB
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
						{AI_USAGE.used}/{AI_USAGE.limit} monthly · {AI_USAGE.tier}
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
						<Show when={activeCategory()}>
							{(cat) => (
								<MailList
									category={cat()}
									rows={rowsFor(cat())}
									selectedId={selected()[cat()]}
									onSelect={(id) => selectRow(cat(), id)}
								/>
							)}
						</Show>
						<section class="pane" data-testid="reading-pane">
							<Show
								when={selectedRow()}
								fallback={
									<div class="empty">
										<div class="ic-box" aria-hidden="true">
											✦
										</div>
										<h3>
											{activeCategory()
												? CATEGORY_META[activeCategory() as CategoryId].title
												: "Hay"}
										</h3>
										<p>
											Select a message to read it here — sender details, AI
											summary, and extracted tasks &amp; dates show up in this
											pane.
										</p>
									</div>
								}
							>
								{(row) => <ThreadView row={row()} onReply={replyToSelected} />}
							</Show>
						</section>
					</>
				}
			>
				<Show when={screen() === "screener"}>
					<ScreenerScreen
						items={screenerItems()}
						onAccept={acceptScreener}
						onReject={rejectScreener}
					/>
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

			{/* ===== Overlays ===== */}
			<Show when={composeOpen()}>
				<ComposeOverlay
					replyTo={replyTo()}
					onClose={() => setComposeOpen(false)}
				/>
			</Show>
			<Show when={assistantOpen()}>
				<AssistantOverlay
					onClose={() => setAssistantOpen(false)}
					onOpenThread={openThread}
				/>
			</Show>
		</div>
	);
};
