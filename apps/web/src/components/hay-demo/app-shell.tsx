import {
	Inbox,
	ListChecks,
	ListFilter,
	type LucideProps,
	Newspaper,
	PenLine,
	Receipt,
	Search,
	Settings,
	Sparkles,
	User,
} from "lucide-solid";
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
import { ComposeOverlay, type ReplyContext } from "./compose-overlay";
import {
	AI_USAGE,
	CATEGORY_META,
	type CategoryId,
	categoryForThread,
	DATE_CARDS,
	MAIL_ROWS,
	type MailRow,
	type NavIcon,
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
	const [replyTo, setReplyTo] = createSignal<ReplyContext | undefined>(
		undefined,
	);
	const [assistantOpen, setAssistantOpen] = createSignal(false);

	// ===== Set aside / Reply later toggles — local/demo-only, keyed by row id
	// so the toggle state persists per-thread across re-selection (prototype
	// parity). No mail is actually moved or scheduled.
	const [setAsideSet, setSetAsideSet] = createSignal<Record<string, boolean>>(
		{},
	);
	const [replyLaterSet, setReplyLaterSet] = createSignal<
		Record<string, boolean>
	>({});
	const toggleSetAside = (id: string) =>
		setSetAsideSet((s) => ({ ...s, [id]: !s[id] }));
	const toggleReplyLater = (id: string) =>
		setReplyLaterSet((s) => ({ ...s, [id]: !s[id] }));

	// Open the Compose overlay as a reply to the selected thread, prefilling the
	// recipient, subject, and greeting from the selected row's own data.
	const replyToSelected = () => {
		const row = selectedRow();
		if (!row) return;
		setReplyTo({
			address: row.address,
			subject: row.subject,
			name: row.from,
		});
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

	// Map a nav icon name onto its lucide-solid component. The prototype hand-
	// rolled equivalent stroke icons; these are the closest lucide matches:
	// screener → Filter (magnifier + crosshair), feed → Newspaper, paper →
	// Receipt, tasks → ListChecks.
	const NAV_ICONS: Record<NavIcon, Component<LucideProps>> = {
		screener: ListFilter,
		inbox: Inbox,
		feed: Newspaper,
		paper: Receipt,
		tasks: ListChecks,
		settings: Settings,
	};

	const NavRow: Component<{ item: NavItem }> = (p) => {
		const count = () => navCount(p.item.id);
		const active = () => screen() === p.item.id;
		const IconCmp = NAV_ICONS[p.item.icon];
		return (
			<button
				type="button"
				class="nav-item"
				classList={{ active: active() }}
				data-testid={`nav-${p.item.id}`}
				aria-current={active() ? "page" : undefined}
				onClick={() => setScreen(p.item.id)}
			>
				<span
					class="nav-chip"
					classList={{
						[`tone-${p.item.tone}`]: p.item.tone !== null,
						"tone-none": p.item.tone === null,
					}}
					aria-hidden="true"
				>
					<IconCmp size={15} stroke-width={2.5} />
				</span>
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
				<span class="topbar-version mono" aria-hidden="true">
					v0.1 · MVP
				</span>
				<span class="spacer" />
				<button
					type="button"
					class="btn sm search-control"
					data-testid="search-ask"
					onClick={() => setAssistantOpen(true)}
				>
					<Search size={14} stroke-width={2.5} />
					<span>Search or ask</span>
					<span class="kbd">⌘K</span>
				</button>
				<button
					type="button"
					class="btn sm primary compose-control"
					data-testid="compose"
					onClick={() => {
						setReplyTo(undefined);
						setComposeOpen(true);
					}}
				>
					<PenLine size={14} stroke-width={2.5} />
					<span>Compose</span>
					<span class="kbd kbd-on-accent">C</span>
				</button>
				<span class="topbar-divider" aria-hidden="true" />
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
				<span class="section-title">Mail</span>
				<For each={PRIMARY_NAV}>{(item) => <NavRow item={item} />}</For>

				<span class="section-title">Assist</span>
				<For each={SECONDARY_NAV}>{(item) => <NavRow item={item} />}</For>

				<span class="spacer" />

				{/* AI usage card — electric-blue AI surface (prototype parity). */}
				<div class="ai-usage" data-testid="ai-usage">
					<div class="ai-usage-head">
						<Sparkles size={12} stroke-width={2.5} aria-hidden="true" />
						<span>AI usage</span>
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
					<span class="ai-usage-meta tabular">
						{AI_USAGE.used}/{AI_USAGE.limit} monthly · {AI_USAGE.tier}
					</span>
				</div>

				{/* Replay onboarding affordance — rendered as a borderless nav-item
				    with a user glyph, matching the prototype's sidebar control. */}
				<button
					type="button"
					class="nav-item replay-shell"
					data-testid="replay-onboarding"
					onClick={() => props.onReplayOnboarding()}
				>
					<span class="replay-glyph" aria-hidden="true">
						<User size={15} stroke-width={2} />
					</span>
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
								{(row) => (
									<ThreadView
										row={row()}
										onReply={replyToSelected}
										setAside={!!setAsideSet()[row().id]}
										replyLater={!!replyLaterSet()[row().id]}
										onToggleSetAside={() => toggleSetAside(row().id)}
										onToggleReplyLater={() => toggleReplyLater(row().id)}
									/>
								)}
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
