import { createFileRoute, redirect } from "@tanstack/solid-router";
import { authClient } from "../lib/auth";

/**
 * /onboarding — Protected placeholder route.
 *
 * Shown to new users who have zero Connected Accounts.
 * Explains:
 *   - Atlas organizes new mail only (new-mail-only disclosure)
 *   - Everyone starts unscreened
 *   - The next step is connecting Gmail or Outlook/Microsoft 365 (coming soon)
 *   - Atlas auth providers (Google/Microsoft/GitHub) are separate from
 *     Connected Account providers
 *
 * No fake CTA, no fake mailbox.
 */
export const Route = createFileRoute("/onboarding")({
	beforeLoad: async () => {
		// Skip auth check during SSR — only enforce on the client
		if (import.meta.env.SSR) return;

		try {
			const session = await authClient.getSession();
			if (!session?.data?.session) {
				throw redirect({ to: "/auth/sign-in?redirect=%2Fonboarding" as "/" });
			}
		} catch (err) {
			if (err && typeof err === "object" && "to" in err) {
				throw err;
			}
			throw redirect({ to: "/auth/sign-in?redirect=%2Fonboarding" as "/" });
		}
	},
	component: OnboardingPage,
});

function OnboardingPage() {
	return (
		<main class="min-h-screen bg-background flex items-center justify-center p-4">
			<div class="w-full max-w-lg">
				<div
					class="bg-secondary-background border-[length:var(--border-w)] border-border rounded-[var(--radius-lg)] p-8"
					style={{ "box-shadow": "var(--shadow-lg)" }}
				>
					<h1
						class="text-3xl text-foreground mb-2"
						style={{ "font-weight": "var(--font-weight-heading)" }}
					>
						Welcome to Atlas
					</h1>
					<p class="text-muted text-sm mb-8">
						You're signed in. Here's what happens next.
					</p>

					<div class="flex flex-col gap-6">
						{/* New mail only */}
						<div
							class="p-4 border-[length:var(--border-w)] border-border rounded-[var(--radius)]"
							style={{ "box-shadow": "var(--shadow-sm)" }}
						>
							<h2
								class="text-base text-foreground mb-1"
								style={{ "font-weight": "var(--font-weight-base)" }}
							>
								New mail only
							</h2>
							<p class="text-muted text-sm">
								Atlas organizes mail that arrives after you connect your inbox.
								Existing messages are not imported or analyzed.
							</p>
						</div>

						{/* Unscreened by default */}
						<div
							class="p-4 border-[length:var(--border-w)] border-border rounded-[var(--radius)]"
							style={{ "box-shadow": "var(--shadow-sm)" }}
						>
							<h2
								class="text-base text-foreground mb-1"
								style={{ "font-weight": "var(--font-weight-base)" }}
							>
								Everyone starts unscreened
							</h2>
							<p class="text-muted text-sm">
								All senders begin in your unscreened queue. Atlas learns your
								preferences as you triage — no manual setup required.
							</p>
						</div>

						{/* Connect your inbox */}
						<div
							class="p-4 border-[length:var(--border-w)] border-border rounded-[var(--radius)] bg-background"
							style={{ "box-shadow": "var(--shadow-sm)" }}
						>
							<h2
								class="text-base text-foreground mb-1"
								style={{ "font-weight": "var(--font-weight-base)" }}
							>
								Connect your inbox — coming soon
							</h2>
							<p class="text-muted text-sm">
								The next step is connecting a Gmail or Outlook / Microsoft 365
								mailbox. This feature is in development and will be available
								shortly.
							</p>
						</div>

						{/* Auth vs Connected Account distinction */}
						<div class="text-xs text-muted border-t border-border pt-4">
							<strong class="text-foreground">Note:</strong> The Google,
							Microsoft, and GitHub accounts you use to sign in to Atlas are
							separate from the Gmail or Outlook mailboxes you connect as
							Connected Accounts. You can sign in with GitHub and still connect
							a Gmail inbox.
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
