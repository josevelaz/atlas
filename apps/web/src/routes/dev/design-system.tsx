import { createFileRoute } from "@tanstack/solid-router";
import { Archive, Bell, Mail, Reply, Search, Star, Zap } from "lucide-solid";
import { For, createSignal } from "solid-js";
import {
	Avatar,
	Badge,
	Button,
	Card,
	Dialog,
	DialogBody,
	DialogHeader,
	Icon,
	Input,
	Kbd,
	Textarea,
	Toggle,
} from "../../components/ui/index";

type DesignSystemSearch = {
	/**
	 * When `overlay=open`, the Dialog renders open on the initial (server)
	 * render. This makes the overlay capturable for visual proof without
	 * depending on client-side hydration / interactivity.
	 */
	overlay?: "open";
};

export const Route = createFileRoute("/dev/design-system")({
	validateSearch: (search: Record<string, unknown>): DesignSystemSearch => ({
		overlay: search.overlay === "open" ? "open" : undefined,
	}),
	component: DesignSystemPage,
});

/* ------------------------------------------------------------------ */
/*  Color token data                                                   */
/* ------------------------------------------------------------------ */

const color_tokens = [
	{ name: "background", var: "--color-background", value: "#F0EBE0" },
	{
		name: "secondary-background",
		var: "--color-secondary-background",
		value: "#FFFDF7",
	},
	{ name: "foreground", var: "--color-foreground", value: "#1D1F27" },
	{ name: "muted", var: "--color-muted", value: "#6B6456" },
	{ name: "main", var: "--color-main", value: "#FACC00" },
	{ name: "border", var: "--color-border", value: "#1D1F27" },
	{ name: "feed", var: "--color-feed", value: "#FFD600" },
	{ name: "paper", var: "--color-paper", value: "#00E5A0" },
	{ name: "ai", var: "--color-ai", value: "#3D7EFF" },
	{ name: "inbox", var: "--color-inbox", value: "#A78BFA" },
	{ name: "danger", var: "--color-danger", value: "#FF4D50" },
] as const;

/* ------------------------------------------------------------------ */
/*  Section heading helper                                             */
/* ------------------------------------------------------------------ */

function SectionHeading(props: { title: string }) {
	return <h2 class="mb-4 text-[16px] text-foreground">{props.title}</h2>;
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

function DesignSystemPage() {
	const search = Route.useSearch();
	const [toggle_on, set_toggle_on] = createSignal(false);
	const [toggle_off, set_toggle_off] = createSignal(true);
	// Initial open state is derived from the URL search param so the overlay
	// renders server-side and is capturable without client hydration.
	const [dialog_open, set_dialog_open] = createSignal(
		search().overlay === "open",
	);

	return (
		<main class="mx-auto flex min-h-screen max-w-3xl flex-col gap-12 bg-background p-8 text-foreground">
			<header>
				<h1 class="text-[22px] text-foreground">Atlas Design System</h1>
				<p class="mt-2 text-sm text-muted">
					Retro neobrutalist primitive gallery — buttons, badges, cards, inputs,
					overlays, avatars, toggles.
				</p>
			</header>

			{/* ── Color Tokens ─────────────────────────────────────── */}
			<section>
				<SectionHeading title="Color Tokens" />
				<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
					<For each={color_tokens}>
						{(token) => (
							<div class="flex flex-col items-center gap-1">
								<div
									class="h-12 w-12 border-[length:var(--border-w)] border-border rounded-[var(--radius)] shadow-[var(--shadow-sm)]"
									style={{ "background-color": `var(${token.var})` }}
								/>
								<span class="text-[11px] text-foreground">{token.name}</span>
								<span class="max-w-[80px] truncate text-[10px] text-muted">
									{token.value}
								</span>
							</div>
						)}
					</For>
				</div>
			</section>

			{/* ── Typography ───────────────────────────────────────── */}
			<section>
				<SectionHeading title="Typography" />
				<div class="flex flex-col gap-3">
					<p
						style={{
							"font-family": "var(--font-display)",
							"font-size": "22px",
						}}
					>
						Bungee — Atlas Display
					</p>
					<p style={{ "font-family": "var(--font-base)", "font-size": "14px" }}>
						Space Mono — the quick brown fox jumps over the lazy dog
					</p>
					<p
						style={{
							"font-family": "var(--font-mono)",
							"font-size": "16px",
						}}
					>
						VT323 — 0123456789 {"{}[]()!@#$%^&*"}
					</p>
				</div>
			</section>

			{/* ── Button ───────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Button" />
				<div class="flex flex-wrap items-center gap-3">
					<Button variant="default">Default</Button>
					<Button variant="primary">Primary</Button>
					<Button variant="danger">Danger</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="default" size="sm">
						<Icon icon={Archive} size={14} /> Archive
					</Button>
					<Button variant="primary" size="sm">
						<Icon icon={Reply} size={14} strokeWidth={2.5} /> Reply
					</Button>
					<Button variant="default" size="sm" icon>
						<Icon icon={Star} size={14} />
					</Button>
					<Button variant="default" disabled>
						Disabled
					</Button>
				</div>
			</section>

			{/* ── Card ─────────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Card" />
				<div class="flex flex-wrap gap-4">
					<Card class="w-[220px] p-4">
						<p class="text-[13px]">Default card surface</p>
						<p class="mt-2 text-[12px] text-muted">
							2px ink border · 5px radius · 4px hard shadow.
						</p>
					</Card>
					<Card size="lg" class="w-[220px] p-4">
						<p class="text-[13px]">Large container</p>
						<p class="mt-2 text-[12px] text-muted">
							8px radius · 6px hard shadow.
						</p>
					</Card>
				</div>
			</section>

			{/* ── Input ────────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Input" />
				<div class="flex max-w-md flex-col gap-3">
					<Input placeholder="Search or ask…" />
					<Input value="rob@atlas.co" disabled />
					<Textarea placeholder="Write a reply…" />
				</div>
			</section>

			{/* ── Avatar ───────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Avatar" />
				<div class="flex flex-wrap items-end gap-3">
					<Avatar name="Alice" size="sm" />
					<Avatar name="Bob" />
					<Avatar name="Grace" />
					<Avatar name="Dave" size="lg" />
					<Avatar name="Heidi" />
					<Avatar name="Sam" />
				</div>
			</section>

			{/* ── Badge ────────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Badge" />

				<p class="mb-2 text-[11px] uppercase tracking-wider text-muted">
					Variants
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<Badge variant="default">default</Badge>
					<Badge variant="main">main</Badge>
					<Badge variant="feed">feed</Badge>
					<Badge variant="paper">paper</Badge>
					<Badge variant="ai">ai</Badge>
					<Badge variant="danger">danger</Badge>
					<Badge variant="inbox">inbox</Badge>
					<Badge variant="muted">muted</Badge>
				</div>

				<p class="mb-2 mt-4 text-[11px] uppercase tracking-wider text-muted">
					Priority
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<Badge priority="P1" />
					<Badge priority="P2" />
					<Badge priority="P3" />
				</div>

				<p class="mb-2 mt-4 text-[11px] uppercase tracking-wider text-muted">
					Square
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<Badge variant="main" square>
						square
					</Badge>
					<Badge variant="feed" square>
						square
					</Badge>
					<Badge variant="ai" square>
						square
					</Badge>
				</div>

				<p class="mb-2 mt-4 text-[11px] uppercase tracking-wider text-muted">
					Tag (utility)
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<span class="atlas-tag">work</span>
					<span class="atlas-tag">finance</span>
					<span class="atlas-tag">urgent</span>
				</div>
			</section>

			{/* ── Kbd ──────────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Kbd" />
				<div class="flex flex-wrap items-center gap-2">
					<Kbd>⌘K</Kbd>
					<Kbd>C</Kbd>
					<Kbd>1</Kbd>
					<Kbd>Esc</Kbd>
				</div>
			</section>

			{/* ── Toggle ───────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Toggle" />
				<div class="flex items-center gap-6">
					<Toggle
						checked={toggle_on()}
						onChange={set_toggle_on}
						label={`Off → ${toggle_on() ? "ON" : "OFF"}`}
					/>
					<Toggle
						checked={toggle_off()}
						onChange={set_toggle_off}
						label={`On → ${toggle_off() ? "ON" : "OFF"}`}
					/>
				</div>
			</section>

			{/* ── Dialog / Overlay ─────────────────────────────────── */}
			<section>
				<SectionHeading title="Dialog / Overlay" />
				<p class="mb-3 text-[12px] text-muted">
					Visit <span class="atlas-kbd">/dev/design-system?overlay=open</span>{" "}
					to render the overlay on initial load (server-rendered, no client
					interaction required).
				</p>
				<Button variant="primary" onClick={() => set_dialog_open(true)}>
					Open dialog
				</Button>
				<Dialog
					open={dialog_open()}
					inline={search().overlay === "open"}
					onClose={() => set_dialog_open(false)}
				>
					<DialogHeader>
						<h3 class="text-[16px]">Compose</h3>
						<Button
							variant="ghost"
							size="sm"
							icon
							onClick={() => set_dialog_open(false)}
						>
							✕
						</Button>
					</DialogHeader>
					<DialogBody>
						<div class="flex flex-col gap-3">
							<Input placeholder="Recipient" />
							<Input placeholder="Subject" />
							<Textarea placeholder="Message…" />
							<div class="flex justify-end gap-2">
								<Button size="sm" onClick={() => set_dialog_open(false)}>
									Discard
								</Button>
								<Button
									variant="primary"
									size="sm"
									onClick={() => set_dialog_open(false)}
								>
									Send
								</Button>
							</div>
						</div>
					</DialogBody>
				</Dialog>
			</section>

			{/* ── Icon ─────────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Icon" />
				<div class="flex flex-wrap items-end gap-4">
					<div class="flex flex-col items-center gap-1">
						<Icon icon={Mail} size={16} />
						<span class="text-[10px] text-muted">16</span>
					</div>
					<div class="flex flex-col items-center gap-1">
						<Icon icon={Star} size={20} />
						<span class="text-[10px] text-muted">20</span>
					</div>
					<div class="flex flex-col items-center gap-1">
						<Icon icon={Bell} size={24} />
						<span class="text-[10px] text-muted">24</span>
					</div>
					<div class="flex flex-col items-center gap-1">
						<Icon icon={Search} size={32} />
						<span class="text-[10px] text-muted">32</span>
					</div>
					<div class="flex flex-col items-center gap-1">
						<Icon icon={Zap} size={24} />
						<span class="text-[10px] text-muted">24</span>
					</div>
				</div>
			</section>

			{/* ── Reduced Motion ───────────────────────────────────── */}
			<section class="atlas-card p-4">
				<p class="text-[13px] text-foreground">♿ Reduced Motion</p>
				<p class="mt-2 text-[12px] text-muted">
					This page respects{" "}
					<span class="atlas-kbd">prefers-reduced-motion</span>. All CSS
					transitions collapse to 0.01 ms and solid-motionone durations drop to
					0.
				</p>
			</section>

			<footer class="pb-8 text-[11px] text-muted">
				Atlas Design System · Spec 02 · Task 02
			</footer>
		</main>
	);
}
