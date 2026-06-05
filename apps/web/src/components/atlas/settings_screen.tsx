// Atlas — Settings screen (full-width workspace region).
//
// Mirrors the prototype's `SettingsScreen` (`docs/prototype/screens.jsx`): a
// thread toolbar titled "Settings" over a centered (max-width 760px) body of
// three carded sections —
//   1. Connected accounts (Google active + Disconnect, Outlook upgrade, Connect
//      another account),
//   2. AI & Privacy (4 AI-keyed toggle rows),
//   3. Notifications (3 toggle rows).
// Every toggle is the shared `Toggle` primitive driven by local Solid signal
// state (one signal per switch) so each switch preserves its own visual state.
// Copy, ordering, default-on/off states, and coded accents come verbatim from
// the prototype. No runtime imports from `docs/prototype/**`.

import type { Component } from "solid-js";
import { createSignal, For } from "solid-js";
import { Badge, Button, Toggle } from "../ui/index";
import { SettingsRow } from "./settings_row";

/** A toggle setting's initial state + descriptive copy (verbatim from proto). */
interface ToggleSetting {
	icon: Parameters<typeof SettingsRow>[0]["icon"];
	tileBackground?: string;
	iconColor?: string;
	iconStroke?: number;
	title: string;
	sub: string;
	defaultOn: boolean;
}

const AI_SETTINGS: ToggleSetting[] = [
	{
		icon: "sparkle",
		tileBackground: "var(--color-ai)",
		iconColor: "#fff",
		title: "Category suggestions",
		sub: "AI proposes Inbox / Feed / Paper Trail. You confirm.",
		defaultOn: true,
	},
	{
		icon: "bolt",
		tileBackground: "var(--color-feed)",
		title: "Priority badges",
		sub: "Sort Inbox by P1/P2/P3 with explanations.",
		defaultOn: true,
	},
	{
		icon: "check",
		tileBackground: "var(--color-paper)",
		iconStroke: 3,
		title: "Extract tasks & dates",
		sub: "Sync confirmed items to Google Tasks & Calendar.",
		defaultOn: true,
	},
	{
		icon: "shield",
		tileBackground: "var(--color-danger)",
		title: "Mailbox-wide analysis",
		sub: "Off — only synced new-mail threads are processed.",
		defaultOn: false,
	},
];

const NOTIFICATION_SETTINGS: ToggleSetting[] = [
	{
		icon: "inbox",
		title: "Inbox — high priority only",
		sub: "PWA notification when a P1 thread arrives.",
		defaultOn: true,
	},
	{
		icon: "screener",
		title: "Screener — urgent only",
		sub: "AI flags potentially urgent first-time senders.",
		defaultOn: true,
	},
	{
		icon: "feed",
		title: "Feed & Paper Trail",
		sub: "Never notify.",
		defaultOn: false,
	},
];

/** A toggle row backed by its own local Solid signal so it preserves state. */
const ToggleSettingRow: Component<{ setting: ToggleSetting }> = (props) => {
	const [on, setOn] = createSignal(props.setting.defaultOn);
	return (
		<SettingsRow
			icon={props.setting.icon}
			tileBackground={props.setting.tileBackground}
			iconColor={props.setting.iconColor}
			iconStroke={props.setting.iconStroke}
			title={props.setting.title}
			sub={props.setting.sub}
			control={<Toggle checked={on()} onChange={setOn} />}
		/>
	);
};

const SettingsScreen: Component = () => {
	return (
		<div class="atlas-thread" data-screen-label="Settings">
			<div class="atlas-thread-toolbar">
				<h2 class="atlas-settings-title">Settings</h2>
			</div>

			<div class="atlas-thread-body">
				<div class="atlas-settings-inner">
					{/* ---- Connected accounts ---- */}
					<h3 class="atlas-settings-section">Connected accounts</h3>
					<div class="atlas-card atlas-settings-card">
						<SettingsRow
							icon="google"
							iconSize={24}
							title="rob@atlas.co"
							subMono
							sub="Google Workspace · synced 24s ago · 142 threads"
							control={
								<div class="atlas-row atlas-gap-8">
									<Badge variant="paper">Active</Badge>
									<Button size="sm">Disconnect</Button>
								</div>
							}
						/>
						<SettingsRow
							icon="outlook"
							iconSize={24}
							title="rob.barrett@outlook.com"
							sub="Microsoft 365 personal · paid tier required"
							control={
								<Button size="sm" variant="primary">
									Upgrade to connect
								</Button>
							}
						/>
						<SettingsRow
							icon="plus"
							iconStroke={2.5}
							tileBackground="var(--color-background)"
							title="Connect another account"
							sub="Gmail, Google Workspace, Outlook, or Microsoft 365"
							control={<Button size="sm">Connect</Button>}
						/>
					</div>

					{/* ---- AI & Privacy ---- */}
					<h3 class="atlas-settings-section">AI &amp; Privacy</h3>
					<div class="atlas-card atlas-settings-card">
						<For each={AI_SETTINGS}>
							{(setting) => <ToggleSettingRow setting={setting} />}
						</For>
					</div>

					{/* ---- Notifications ---- */}
					<h3 class="atlas-settings-section">Notifications</h3>
					<div class="atlas-card atlas-settings-card">
						<For each={NOTIFICATION_SETTINGS}>
							{(setting) => <ToggleSettingRow setting={setting} />}
						</For>
					</div>
				</div>
			</div>
		</div>
	);
};

export { SettingsScreen };
