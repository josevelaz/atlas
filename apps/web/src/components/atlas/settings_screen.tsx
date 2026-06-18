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
import { createMemo, createSignal, For, Show } from "solid-js";
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
	useDisconnectAccount,
	useSetPrimary,
	useUpdateDisplayName,
	useUser,
} from "../../lib/identity/queries";
import type {
	ConnectedAccount,
	ConnectedAccountSyncState,
} from "../../lib/identity/types";
import { Badge, Button, Card, Input, Toggle } from "../ui/index";
import type { IconName } from "./atlas_icon";
import { AtlasAvatar } from "./mail_row";
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
 * Profile card — the signed-in user's avatar (read-only), an editable display
 * name, and the read-only login email. All three read from the shared
 * `['identity','me']` cache via `useUser()`.
 *
 * Saving the display name round-trips through Better Auth
 * (`useUpdateDisplayName()`), which invalidates `['identity','me']` on success.
 * Because the top bar's avatar/name also read that same cache through
 * `useUser()`, the chip re-renders reactively the moment the refetch lands —
 * no extra wiring needed.
 *
 * Save is disabled while the mutation is pending, while the field is empty,
 * and while the trimmed draft matches the persisted name (nothing to save).
 */
const ProfileCard: Component = () => {
	const user = useUser();
	const updateName = useUpdateDisplayName();

	// Editable draft, seeded once and overridden by user edits. `undefined`
	// means "untouched" — fall back to the live cache value so a background
	// refetch (or the initial load) flows through until the user types.
	const [draft, setDraft] = createSignal<string>();
	const value = () => draft() ?? user.data?.name ?? "";

	// Unchanged when the trimmed draft equals the persisted name. Empty (after
	// trim) is also non-savable.
	const trimmed = createMemo(() => value().trim());
	const isUnchanged = () => trimmed() === (user.data?.name ?? "");
	const canSave = () =>
		!updateName.isPending && trimmed().length > 0 && !isUnchanged();

	const handleSave = () => {
		if (!canSave()) return;
		updateName.mutate(trimmed(), {
			// Snap the draft back to "untouched" so it tracks the freshly
			// invalidated cache value once the refetch resolves.
			onSuccess: () => setDraft(undefined),
		});
	};

	return (
		<Card class={settingsCardClasses}>
			{/* Avatar (read-only) — same chip the top bar shows, sourced from the
			    shared identity cache via `useUser()`. */}
			<div class="flex items-center gap-3.5 border-b-[length:var(--border-w)] border-border border-solid px-4 py-3.5">
				<AtlasAvatar
					name={user.data?.name ?? "·"}
					src={user.data?.image ?? undefined}
					size="lg"
				/>
				<div class="font-[family-name:var(--font-mono)] text-[14px] font-bold">
					{user.data?.name ?? ""}
				</div>
			</div>
			<SettingsRow
				icon="user"
				iconSize={24}
				tileBackground="var(--color-background)"
				title="Display name"
				sub="Shown on the top bar and as your sender name."
				control={
					<div class="flex items-center gap-2">
						<Input
							value={value()}
							onInput={(e) => setDraft(e.currentTarget.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSave();
							}}
							aria-label="Display name"
							class="w-48 max-[560px]:w-full"
						/>
						<Button
							size="sm"
							variant="primary"
							disabled={!canSave()}
							onClick={handleSave}
						>
							{updateName.isPending ? "Saving…" : "Save"}
						</Button>
					</div>
				}
			/>
			<SettingsRow
				icon="user"
				iconSize={24}
				title="Login email"
				sub={user.data?.email ?? ""}
				subMono
				control={<Badge>Read-only</Badge>}
			/>
		</Card>
	);
};

/** Badge variant name (mirrors the `Badge` primitive's variant union). */
type BadgeVariant =
	| "default"
	| "main"
	| "feed"
	| "paper"
	| "ai"
	| "danger"
	| "inbox"
	| "muted";

/**
 * Resolve a connected account's sync-state chip (label + coded badge variant):
 *   - disconnected (status)  → "Disconnected"         (alarm-red)
 *   - "watching"             → "Watching"             (mint — live push)
 *   - "polling"              → "Polling"              (lilac — periodic)
 *   - "degraded"            → "Degraded — retrying"   (feed yellow)
 *   - "pending" / null      → "Connecting…"           (muted)
 *
 * Coded accents stay small (a single badge) and AI-blue is never used here —
 * it is reserved for the machine's voice (DESIGN.md).
 */
function syncStateChip(account: ConnectedAccount): {
	label: string;
	variant: BadgeVariant;
} {
	if (account.status === "disconnected") {
		return { label: "Disconnected", variant: "danger" };
	}
	const state: ConnectedAccountSyncState | null | undefined = account.syncState;
	if (state === "watching") return { label: "Watching", variant: "paper" };
	if (state === "polling") return { label: "Polling", variant: "inbox" };
	if (state === "degraded") {
		return { label: "Degraded — retrying", variant: "feed" };
	}
	return { label: "Connecting…", variant: "muted" };
}

/** Trailing controls for one connected-account row. */
const ConnectedAccountControls: Component<{ account: ConnectedAccount }> = (
	props,
) => {
	const setPrimary = useSetPrimary();
	const disconnect = useDisconnectAccount();

	const chip = () => syncStateChip(props.account);
	const isDisconnected = () => props.account.status === "disconnected";

	return (
		<div class="flex flex-wrap items-center justify-end gap-2">
			{/* Per-account sync-state chip (always shown). */}
			<Badge variant={chip().variant}>{chip().label}</Badge>
			<Show
				when={!isDisconnected()}
				fallback={<Badge variant="muted">Read-only</Badge>}
			>
				<Show
					when={props.account.isPrimary}
					fallback={
						<Button
							size="sm"
							disabled={setPrimary.isPending}
							onClick={() => setPrimary.mutate(props.account.id)}
						>
							Set primary
						</Button>
					}
				>
					<Badge variant="paper">Primary</Badge>
				</Show>
				<Button
					size="sm"
					variant="danger"
					disabled={disconnect.isPending}
					onClick={() => disconnect.mutate(props.account.id)}
				>
					Disconnect
				</Button>
			</Show>
		</div>
	);
};

/**
 * Connected-account rows backed by the shared identity query cache. Each row
 * carries a sync-state chip (Watching / Polling / Degraded — retrying /
 * Disconnected), a "Primary" badge (or "Set primary" —
 * `PUT /me/primary-connected-account`), and a "Disconnect" action (task 11
 * `POST /me/connected-accounts/:id/disconnect`).
 *
 * Disconnected accounts are marked read-only: their actions collapse to a
 * single "Read-only" badge (no Set-primary / Disconnect), since a disconnected
 * source no longer syncs and its threads are read-only.
 */
const ConnectedAccountsCard: Component = () => {
	const accounts = useConnectedAccounts();

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
						control={<ConnectedAccountControls account={account} />}
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
					{/* ---- Profile ---- */}
					<h3 class={settingsSectionClasses}>Profile</h3>
					<ProfileCard />

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
