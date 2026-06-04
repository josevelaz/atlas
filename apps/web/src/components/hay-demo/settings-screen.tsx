import { Bell, Mailbox, RotateCcw, ShieldCheck, Sparkles } from "lucide-solid";
import type { Component, JSX } from "solid-js";
import { createSignal, For } from "solid-js";

/**
 * SettingsScreen — full-width Settings surface (prototype alternate view).
 *
 * Recreates the prototype's `.settings-row` stack: an icon chip, a title +
 * description, and a trailing control (toggle or button). Includes a
 * "Replay onboarding" affordance wired to the shell so reviewers can re-run
 * the walkthrough. All toggles are local-only and mutate no real settings.
 */

type SettingRow = {
	id: string;
	icon: Component<{ size?: number; "stroke-width"?: number }>;
	title: string;
	desc: string;
	control: "toggle" | "replay";
	defaultOn?: boolean;
};

const ROWS: SettingRow[] = [
	{
		id: "screener",
		icon: ShieldCheck,
		title: "Screen first-time senders",
		desc: "Hold mail from unknown senders for a quick accept-or-reject.",
		control: "toggle",
		defaultOn: true,
	},
	{
		id: "ai",
		icon: Sparkles,
		title: "AI summaries & extraction",
		desc: "Summarize long threads and pull out tasks and dates automatically.",
		control: "toggle",
		defaultOn: true,
	},
	{
		id: "digest",
		icon: Bell,
		title: "Daily Feed digest",
		desc: "Bundle newsletters and broadcasts into one morning summary.",
		control: "toggle",
		defaultOn: false,
	},
	{
		id: "mailbox",
		icon: Mailbox,
		title: "Connected mailbox",
		desc: "you@gmail.com · syncing new mail only.",
		control: "toggle",
		defaultOn: true,
	},
	{
		id: "replay",
		icon: RotateCcw,
		title: "Replay onboarding",
		desc: "Walk through the Hay intro flow again.",
		control: "replay",
	},
];

const Toggle: Component<{
	on: boolean;
	onToggle: () => void;
	label: string;
}> = (props) => (
	<button
		type="button"
		class="btn"
		role="switch"
		aria-checked={props.on}
		aria-label={props.label}
		onClick={() => props.onToggle()}
		style={{
			width: "52px",
			padding: "0",
			"justify-content": props.on ? "flex-end" : "flex-start",
			background: props.on ? "var(--color-paper)" : "var(--demo-surface)",
		}}
	>
		<span
			aria-hidden="true"
			style={{
				display: "inline-block",
				width: "20px",
				height: "20px",
				margin: "0 4px",
				border: "var(--border-w) solid var(--demo-border)",
				"border-radius": "4px",
				background: "var(--demo-surface)",
			}}
		/>
	</button>
);

export const SettingsScreen: Component<{
	onReplayOnboarding: () => void;
}> = (props) => {
	const [toggles, setToggles] = createSignal<Record<string, boolean>>(
		Object.fromEntries(
			ROWS.filter((r) => r.control === "toggle").map((r) => [
				r.id,
				!!r.defaultOn,
			]),
		),
	);

	const flip = (id: string) => setToggles((t) => ({ ...t, [id]: !t[id] }));

	const renderControl = (row: SettingRow): JSX.Element => {
		if (row.control === "replay") {
			return (
				<button
					type="button"
					class="btn"
					data-testid="settings-replay-onboarding"
					onClick={() => props.onReplayOnboarding()}
				>
					Replay
				</button>
			);
		}
		return (
			<Toggle
				on={!!toggles()[row.id]}
				onToggle={() => flip(row.id)}
				label={row.title}
			/>
		);
	};

	return (
		<div class="pane" data-testid="settings-screen">
			<div class="list-header">
				<div class="col">
					<h2>Settings</h2>
					<span class="meta">How Hay handles your mail</span>
				</div>
			</div>

			<div class="settings-scroll">
				<div class="card settings-card">
					<For each={ROWS}>
						{(row) => (
							<div class="settings-row" data-testid={`settings-row-${row.id}`}>
								<span class="ic" aria-hidden="true">
									<row.icon size={22} stroke-width={2.5} />
								</span>
								<div class="col gap-4">
									<span style={{ "font-weight": "800" }}>{row.title}</span>
									<span class="muted" style={{ "font-size": "13px" }}>
										{row.desc}
									</span>
								</div>
								{renderControl(row)}
							</div>
						)}
					</For>
				</div>
			</div>
		</div>
	);
};
