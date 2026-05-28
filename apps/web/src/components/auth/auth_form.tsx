import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { authClient } from "../../lib/auth";
import { isDesktop, startDesktopAuth } from "../../lib/desktop_auth";
import { Button } from "../ui/button";

export type AuthFormProps = {
	mode: "sign-in" | "sign-up";
	redirect?: string;
	error?: string;
};

const PROVIDERS = [
	{ id: "google", label: "Continue with Google" },
	{ id: "microsoft", label: "Continue with Microsoft" },
	{ id: "github", label: "Continue with GitHub" },
] as const;

type Provider = (typeof PROVIDERS)[number]["id"];

const AuthForm: Component<AuthFormProps> = (props) => {
	const handleProviderClick = async (provider: Provider) => {
		if (isDesktop()) {
			await startDesktopAuth(
				provider,
				props.mode === "sign-in" ? "/auth/sign-in" : "/auth/sign-up",
			);
			return;
		}

		const errorCallbackURL =
			props.mode === "sign-in" ? "/auth/sign-in" : "/auth/sign-up";

		await authClient.signIn.social({
			provider,
			callbackURL: "/auth/complete",
			errorCallbackURL,
			newUserCallbackURL: "/auth/complete",
		});
	};

	return (
		<main class="min-h-screen bg-background flex items-center justify-center p-4">
			<div class="w-full max-w-md">
				{/* Card */}
				<div
					class="bg-secondary-background border-[length:var(--border-w)] border-border rounded-[var(--radius-lg)] p-8"
					style={{ "box-shadow": "var(--shadow-lg)" }}
				>
					{/* Logo / Brand */}
					<div class="mb-8 text-center">
						<h1
							class="text-4xl text-foreground mb-2"
							style={{ "font-weight": "var(--font-weight-heading)" }}
						>
							Atlas
						</h1>
						<p class="text-muted text-sm leading-snug">
							A clear view of who matters, what needs action, and what can wait.
						</p>
					</div>

					{/* Error banner */}
					<Show when={props.error}>
						<div
							class="mb-6 p-3 bg-danger border-[length:var(--border-w)] border-border rounded-[var(--radius)] text-sm text-foreground"
							style={{ "box-shadow": "var(--shadow-sm)" }}
						>
							<strong>Sign-in error:</strong>{" "}
							<Show
								when={props.error === "access_denied"}
								fallback={
									<Show
										when={props.error === "desktop_auth_failed"}
										fallback={`Authentication error: ${props.error}`}
									>
										Desktop authentication failed. Please try again.
									</Show>
								}
							>
								Access was denied. Please try again.
							</Show>{" "}
						</div>
					</Show>

					{/* Social-only disclosure */}
					<p class="text-muted text-xs text-center mb-6">
						{props.mode === "sign-in"
							? "Sign in with your social account — no password needed."
							: "Create your account using a social provider — no password needed."}
					</p>

					{/* Provider buttons */}
					<div class="flex flex-col gap-3">
						<For each={PROVIDERS}>
							{(provider) => (
								<Button
									variant="default"
									class="w-full justify-center"
									onClick={() => handleProviderClick(provider.id)}
								>
									{provider.label}
								</Button>
							)}
						</For>
					</div>

					{/* Desktop hint */}
					<Show when={isDesktop()}>
						<p class="text-muted text-xs text-center mt-4">
							Continues in your browser
						</p>
					</Show>

					{/* Cross-link */}
					<div class="mt-6 text-center text-sm text-muted">
						<Show
							when={props.mode === "sign-in"}
							fallback={
								<span>
									Already have an account?{" "}
									<a
										href="/auth/sign-in"
										class="text-foreground underline font-[var(--font-weight-base)] hover:text-main"
									>
										Sign in
									</a>
								</span>
							}
						>
							<span>
								New to Atlas?{" "}
								<a
									href="/auth/sign-up"
									class="text-foreground underline font-[var(--font-weight-base)] hover:text-main"
								>
									Create account
								</a>
							</span>
						</Show>
					</div>
				</div>
			</div>
		</main>
	);
};

export { AuthForm };
