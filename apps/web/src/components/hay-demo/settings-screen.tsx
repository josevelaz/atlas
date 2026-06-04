import {
	Bolt,
	Inbox,
	Mail,
	type LucideProps,
	Plus,
	RotateCcw,
	Rss,
	ShieldCheck,
	ShieldX,
	Sparkles,
	SquareCheck,
} from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, For } from "solid-js";

/**
 * SettingsScreen — full-width Settings surface (prototype alternate view).
 *
 * Recreates the prototype's grouped Settings layout: three sections
 * (Connected accounts · AI & Privacy · Notifications), each a `.card` of
 * `.settings-row`s. Each row is an icon chip + title/description + a trailing
 * control (toggle, badge, or button). A "Replay onboarding" affordance is
 * appended so reviewers can re-run the walkthrough.
 *
 * Everything is LOCAL/DEMO-ONLY: toggles mutate local signal state, no real
 * account is connected, disconnected, or upgraded, and no setting persists.
 */

type IconComp = Component<LucideProps>;

const Toggle: Component<{
	on: boolean;
	onToggle: () => void;
	label: string;
}> = (props) => (
	<button
		type="button"
		class="settings-toggle"
		classList={{ on: props.on }}
		role="switch"
		aria-checked={props.on}
		aria-label={props.label}
		onClick={() => props.onToggle()}
	>
		<span class="knob" aria-hidden="true" />
	</button>
);

const IconChip: Component<{
	icon: IconComp;
	accent?: "ai" | "feed" | "paper" | "danger" | "plain";
}> = (props) => (
	<span
		class="ic"
		classList={{ [`ic-${props.accent ?? "plain"}`]: true }}
		aria-hidden="true"
	>
		<props.icon size={22} stroke-width={2.5} />
	</span>
);

export const SettingsScreen: Component<{
	onReplayOnboarding: () => void;
}> = (props) => {
	// Local toggle state for the AI & Privacy / Notifications rows.
	const [toggles, setToggles] = createSignal<Record<string, boolean>>({
		"ai-category": true,
		"ai-priority": true,
		"ai-extract": true,
		"ai-mailbox": false,
		"notify-inbox": true,
		"notify-screener": true,
		"notify-feed": false,
	});
	const flip = (id: string) => setToggles((t) => ({ ...t, [id]: !t[id] }));

	return (
		<div class="thread settings-screen" data-testid="settings-screen">
			<div class="thread-toolbar">
				<div class="col" style={{ gap: "2px" }}>
					<h2 class="thread-subject">Settings</h2>
					<span class="meta">How Hay handles your mail</span>
				</div>
			</div>

			<div class="thread-body settings-body">
				{/* ===== Connected accounts ===== */}
				<h3 class="settings-section">Connected accounts</h3>
				<div class="card settings-card">
					<div class="settings-row" data-testid="settings-account-google">
						<IconChip icon={Mail} />
						<div class="col gap-4" style={{ "min-width": "0" }}>
							<span class="settings-title">rob@hay.co</span>
							<span class="mono settings-sub">
								Google Workspace · synced 24s ago · 142 threads
							</span>
						</div>
						<div class="row gap-8">
							<span class="badge solid-paper">Active</span>
							<button type="button" class="btn sm">
								Disconnect
							</button>
						</div>
					</div>
					<div class="settings-row" data-testid="settings-account-outlook">
						<IconChip icon={Mail} />
						<div class="col gap-4" style={{ "min-width": "0" }}>
							<span class="settings-title">rob.barrett@outlook.com</span>
							<span class="mono settings-sub">
								Microsoft 365 personal · paid tier required
							</span>
						</div>
						<button type="button" class="btn sm primary">
							Upgrade to connect
						</button>
					</div>
					<div
						class="settings-row settings-row-add"
						data-testid="settings-account-add"
					>
						<IconChip icon={Plus} accent="plain" />
						<div class="col gap-4" style={{ "min-width": "0" }}>
							<span class="settings-title">Connect another account</span>
							<span class="muted settings-sub">
								Gmail, Google Workspace, Outlook, or Microsoft 365
							</span>
						</div>
						<button type="button" class="btn sm">
							Connect
						</button>
					</div>
				</div>

				{/* ===== AI & Privacy ===== */}
				<h3 class="settings-section">AI &amp; Privacy</h3>
				<div class="card settings-card">
					<For each={AI_ROWS}>
						{(row) => (
							<div class="settings-row" data-testid={`settings-row-${row.id}`}>
								<IconChip icon={row.icon} accent={row.accent} />
								<div class="col gap-4" style={{ "min-width": "0" }}>
									<span class="settings-title">{row.title}</span>
									<span class="muted settings-sub">{row.desc}</span>
								</div>
								<Toggle
									on={!!toggles()[row.id]}
									onToggle={() => flip(row.id)}
									label={row.title}
								/>
							</div>
						)}
					</For>
				</div>

				{/* ===== Notifications ===== */}
				<h3 class="settings-section">Notifications</h3>
				<div class="card settings-card">
					<For each={NOTIFY_ROWS}>
						{(row) => (
							<div class="settings-row" data-testid={`settings-row-${row.id}`}>
								<IconChip icon={row.icon} />
								<div class="col gap-4" style={{ "min-width": "0" }}>
									<span class="settings-title">{row.title}</span>
									<span class="muted settings-sub">{row.desc}</span>
								</div>
								<Toggle
									on={!!toggles()[row.id]}
									onToggle={() => flip(row.id)}
									label={row.title}
								/>
							</div>
						)}
					</For>
				</div>

				{/* ===== Onboarding ===== */}
				<h3 class="settings-section">Onboarding</h3>
				<div class="card settings-card">
					<div class="settings-row">
						<IconChip icon={RotateCcw} accent="plain" />
						<div class="col gap-4" style={{ "min-width": "0" }}>
							<span class="settings-title">Replay onboarding</span>
							<span class="muted settings-sub">
								Walk through the Hay intro flow again.
							</span>
						</div>
						<button
							type="button"
							class="btn sm"
							data-testid="settings-replay-onboarding"
							onClick={() => props.onReplayOnboarding()}
						>
							Replay
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

type SettingRow = {
	id: string;
	icon: IconComp;
	title: string;
	desc: string;
	accent?: "ai" | "feed" | "paper" | "danger" | "plain";
};

const AI_ROWS: SettingRow[] = [
	{
		id: "ai-category",
		icon: Sparkles,
		title: "Category suggestions",
		desc: "AI proposes Inbox / Feed / Paper Trail. You confirm.",
		accent: "ai",
	},
	{
		id: "ai-priority",
		icon: Bolt,
		title: "Priority badges",
		desc: "Sort Inbox by P1/P2/P3 with explanations.",
		accent: "feed",
	},
	{
		id: "ai-extract",
		icon: SquareCheck,
		title: "Extract tasks & dates",
		desc: "Sync confirmed items to Google Tasks & Calendar.",
		accent: "paper",
	},
	{
		id: "ai-mailbox",
		icon: ShieldX,
		title: "Mailbox-wide analysis",
		desc: "Off — only synced new-mail threads are processed.",
		accent: "danger",
	},
];

const NOTIFY_ROWS: SettingRow[] = [
	{
		id: "notify-inbox",
		icon: Inbox,
		title: "Inbox — high priority only",
		desc: "PWA notification when a P1 thread arrives.",
	},
	{
		id: "notify-screener",
		icon: ShieldCheck,
		title: "Screener — urgent only",
		desc: "AI flags potentially urgent first-time senders.",
	},
	{
		id: "notify-feed",
		icon: Rss,
		title: "Feed & Paper Trail",
		desc: "Never notify.",
	},
];
