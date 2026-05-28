import { createFileRoute } from "@tanstack/solid-router";
import { authClient } from "../lib/auth";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	const handleSignOut = async () => {
		await authClient.signOut();
		window.location.href = "/auth/sign-in";
	};

	return (
		<main class="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
			<h1
				class="text-4xl text-foreground"
				style={{ "font-weight": "var(--font-weight-heading)" }}
			>
				Atlas
			</h1>
			<p class="text-muted text-sm">You're signed in.</p>
			<Button variant="default" onClick={handleSignOut}>
				Sign out
			</Button>
		</main>
	);
}
