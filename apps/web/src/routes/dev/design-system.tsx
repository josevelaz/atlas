import { createFileRoute } from "@tanstack/solid-router";
import { For, createSignal } from "solid-js";
import { Avatar, Badge, Button, Icon, Toggle } from "../../components/ui/index";
import { Bell, Mail, Search, Star, Zap } from "lucide-solid";

export const Route = createFileRoute("/dev/design-system")({
	component: DesignSystemPage,
});

/* ------------------------------------------------------------------ */
/*  Color token data                                                   */
/* ------------------------------------------------------------------ */

const color_tokens = [
	{
		name: "background",
		var: "--color-background",
		value: "oklch(92.13% 0.0388 282.36)",
	},
	{
		name: "secondary-background",
		var: "--color-secondary-background",
		value: "oklch(100% 0 0)",
	},
	{
		name: "foreground",
		var: "--color-foreground",
		value: "oklch(0% 0 0)",
	},
	{ name: "muted", var: "--color-muted", value: "oklch(40% 0.02 282)" },
	{
		name: "main",
		var: "--color-main",
		value: "oklch(66.34% 0.1806 277.2)",
	},
	{
		name: "main-foreground",
		var: "--color-main-foreground",
		value: "oklch(0% 0 0)",
	},
	{ name: "border", var: "--color-border", value: "oklch(0% 0 0)" },
	{ name: "feed", var: "--color-feed", value: "#FACC00" },
	{ name: "paper", var: "--color-paper", value: "#00D696" },
	{ name: "danger", var: "--color-danger", value: "#FF4D50" },
	{ name: "ai", var: "--color-ai", value: "#0099FF" },
	{ name: "inbox", var: "--color-inbox", value: "#7A83FF" },
] as const;

/* ------------------------------------------------------------------ */
/*  Section heading helper                                             */
/* ------------------------------------------------------------------ */

function SectionHeading(props: { title: string }) {
	return (
		<h2
			class="mb-4 text-xl text-foreground"
			style={{ "font-weight": "var(--font-weight-heading)" }}
		>
			{props.title}
		</h2>
	);
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

function DesignSystemPage() {
	const [toggle_on, set_toggle_on] = createSignal(false);

	return (
		<main class="mx-auto flex min-h-screen max-w-3xl flex-col gap-12 bg-background p-8 text-foreground">
			<header>
				<h1
					class="text-3xl text-foreground"
					style={{ "font-weight": "var(--font-weight-heading)" }}
				>
					Hay Design System
				</h1>
				<p class="mt-1 text-sm text-muted" style={{ "font-weight": "400" }}>
					Token showcase &amp; component gallery
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
									class="h-12 w-12 border-[length:var(--border-w)] border-border rounded-[var(--radius)]"
									style={{ "background-color": `var(${token.var})` }}
								/>
								<span
									class="text-[11px] text-foreground"
									style={{ "font-weight": "var(--font-weight-base)" }}
								>
									{token.name}
								</span>
								<span class="max-w-[80px] truncate text-[9px] text-muted">
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
					<p class="text-lg" style={{ "font-weight": "400" }}>
						Archivo 400 — The quick brown fox jumps over the lazy dog
					</p>
					<p class="text-lg" style={{ "font-weight": "600" }}>
						Archivo 600 — The quick brown fox jumps over the lazy dog
					</p>
					<p class="text-lg" style={{ "font-weight": "700" }}>
						Archivo 700 — The quick brown fox jumps over the lazy dog
					</p>
					<p class="text-lg" style={{ "font-weight": "900" }}>
						Archivo 900 — The quick brown fox jumps over the lazy dog
					</p>
					<p class="mt-2 font-mono text-sm text-muted">
						JetBrains Mono — 0123456789 {"{}[]()!@#$%^&*"}
					</p>
				</div>
			</section>

			{/* ── Button ───────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Button" />
				<div class="flex flex-wrap items-center gap-3">
					<Button variant="default">Default</Button>
					<Button variant="primary">Primary</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="default" size="sm">
						Small
					</Button>
					<Button variant="default" disabled>
						Disabled
					</Button>
				</div>
			</section>

			{/* ── Avatar ───────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Avatar" />
				<div class="flex flex-wrap items-end gap-3">
					<Avatar name="Alice" size="sm" />
					<Avatar name="Bob" />
					<Avatar name="Carol" />
					<Avatar name="Dave" size="lg" />
					<Avatar name="Eve" />
					<Avatar name="Frank" />
				</div>
			</section>

			{/* ── Badge ────────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Badge" />

				{/* All variants */}
				<p
					class="mb-2 text-xs text-muted"
					style={{ "font-weight": "var(--font-weight-base)" }}
				>
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

				{/* Priority badges */}
				<p
					class="mb-2 mt-4 text-xs text-muted"
					style={{ "font-weight": "var(--font-weight-base)" }}
				>
					Priority
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<Badge priority="P1" />
					<Badge priority="P2" />
					<Badge priority="P3" />
				</div>

				{/* Square badges */}
				<p
					class="mb-2 mt-4 text-xs text-muted"
					style={{ "font-weight": "var(--font-weight-base)" }}
				>
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
			</section>

			{/* ── Toggle ───────────────────────────────────────────── */}
			<section>
				<SectionHeading title="Toggle" />
				<div class="flex items-center gap-4">
					<Toggle
						checked={toggle_on()}
						onChange={set_toggle_on}
						label="Enable feature"
					/>
					<span class="text-sm text-muted">
						State: {toggle_on() ? "ON" : "OFF"}
					</span>
				</div>
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
			<section class="rounded-[var(--radius-lg)] border-[length:var(--border-w)] border-border bg-secondary-background p-4">
				<p
					class="text-sm text-foreground"
					style={{ "font-weight": "var(--font-weight-base)" }}
				>
					♿ Reduced Motion
				</p>
				<p class="mt-1 text-xs text-muted" style={{ "font-weight": "400" }}>
					This page respects{" "}
					<code class="rounded bg-background px-1 py-0.5 font-mono text-[11px]">
						prefers-reduced-motion
					</code>
					. Toggle it in your OS accessibility settings to disable animations.
					All CSS transitions collapse to 0.01 ms and solid-motionone durations
					drop to 0.
				</p>
			</section>

			<footer class="pb-8 text-xs text-muted" style={{ "font-weight": "400" }}>
				Hay Design System · Spec 01 · Task 5.0
			</footer>
		</main>
	);
}
