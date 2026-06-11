// Atlas — Settings screen (full-width workspace region).
//
// Mirrors the prototype's `SettingsScreen` (`docs/prototype/screens.jsx`): a
// thread toolbar titled "Settings" over a centered (max-width 760px) body of
// three carded sections —
//   1. Connected accounts — real rows from `useConnectedAccounts()` (one per
//      OAuth `account` row): the primary account carries a "Primary" badge,
//      others get a "Set primary" button (`useSetPrimary()`), plus a trailing
//      "Connect another account" row that starts a Google link flow,
//   2. AI & Privacy (4 AI-keyed toggle rows),
//   3. Notifications (3 toggle rows).
// Every toggle is the shared `Toggle` primitive driven by local Solid signal
// state (one signal per switch) so each switch preserves its own visual state.
// Copy, ordering, default-on/off states, and coded accents come verbatim from
// the prototype. No runtime imports from `docs/prototype/**`.

import type { Component } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import {
	settingsCardClasses,
	settingsInnerClasses,
	settingsSectionClasses,
	settingsTitleClasses,
	threadBodyClasses,
	threadClasses,
	threadToolbarClasses,
} from "../../lib/atlas/component_classes";
import { getAuthClient } from "../../lib/auth";
import {
	useConnectedAccounts,
	useSetPrimary,
} from "../../lib/identity/queries";
import { Badge, Button, Card, Toggle } from "../ui/index";
import type { IconName } from "./atlas_icon";
import { SettingsRow } from "./settings_row";

/** Icon + human label for a Better Auth `providerId`. */
interface ProviderMeta {
	icon: IconName;
	label: string;
}

const PROVIDER_META: Record<string, ProviderMeta> = {
	google: { icon: "google", label: "Google" },
	outlook: { icon: "outlook", label: "Outlook" },
	microsoft: { icon: "outlook", label: "Microsoft 365" },
};

/** Map a providerId to its icon/label, falling back to a generic row. */
function providerMeta(providerId: string): ProviderMeta {
	return (
		PROVIDER_META[providerId] ?? {
			icon: "user",
			label: providerId.charAt(0).toUpperCase() + providerId.slice(1),
		}
	);
}

/**
 * Connected-account rows backed by the shared identity query cache. The
 * primary row shows a "Primary" badge; others offer "Set primary", which
 * round-trips through `PUT /me/primary-connected-account` and invalidates
 * the connected-accounts query (so compose and other consumers re-render).
 */
const ConnectedAccountsCard: Component = () => {
	const accounts = useConnectedAccounts();
	const setPrimary = useSetPrimary();

	const handleConnect = () => {
		getAuthClient().linkSocial({
			provider: "google",
			callbackURL: new URL("/settings", window.location.origin).toString(),
		});
	};

	return (
		<Card class={settingsCardClasses}>
			<For each={accounts.data?.accounts ?? []}>
				{(account) => (
					<SettingsRow
						icon={providerMeta(account.providerId).icon}
						iconSize={24}
						title={account.email}
						sub={providerMeta(account.providerId).label}
						control={
							<Show
								when={account.isPrimary}
								fallback={
									<Button
										size="sm"
										disabled={setPrimary.isPending}
										onClick={() => setPrimary.mutate(account.id)}
									>
										Set primary
									</Button>
								}
							>
								<Badge variant="paper">Primary</Badge>
							</Show>
						}
					/>
				)}
			</For>
			<SettingsRow
				icon="plus"
				iconStroke={2.5}
				tileBackground="var(--color-background)"
				title="Connect another account"
				sub="Gmail, Google Workspace, Outlook, or Microsoft 365"
				control={
					<Button size="sm" onClick={handleConnect}>
						Connect
					</Button>
				}
			/>
		</Card>
	);
};

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
		<div class={threadClasses} data-screen-label="Settings">
			<div class={threadToolbarClasses}>
				<h2 class={settingsTitleClasses}>Settings</h2>
			</div>

			<div class={threadBodyClasses}>
				<div class={settingsInnerClasses}>
					{/* ---- Connected accounts ---- */}
					<h3 class={settingsSectionClasses}>Connected accounts</h3>
					<ConnectedAccountsCard />

					{/* ---- AI & Privacy ---- */}
					<h3 class={settingsSectionClasses}>AI &amp; Privacy</h3>
					<Card class={settingsCardClasses}>
						<For each={AI_SETTINGS}>
							{(setting) => <ToggleSettingRow setting={setting} />}
						</For>
					</Card>

					{/* ---- Notifications ---- */}
					<h3 class={settingsSectionClasses}>Notifications</h3>
					<Card class={settingsCardClasses}>
						<For each={NOTIFICATION_SETTINGS}>
							{(setting) => <ToggleSettingRow setting={setting} />}
						</For>
					</Card>
				</div>
			</div>
		</div>
	);
};

export { SettingsScreen };
