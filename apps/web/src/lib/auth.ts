import { createAuthClient } from "better-auth/client";
import { apiUrl } from "./api";

/**
 * Better Auth client for the web app.
 *
 * This is the single source of truth for all Better Auth client calls in apps/web.
 * The baseURL points to the API server's auth endpoint.
 *
 * SSR note: The auth client requires an absolute URL for the baseURL in SSR context.
 * In SPA mode, all auth calls happen client-side, so we use a fallback absolute URL
 * for SSR that will never actually be called (the SSR guard in beforeLoad prevents it).
 *
 * Usage:
 *   import { authClient } from "~/lib/auth"
 *   await authClient.signIn.social({ provider: "google", callbackURL: "/auth/complete" })
 *   const session = await authClient.getSession()
 *   await authClient.signOut()
 */

// In SSR context, relative URLs are invalid for fetch(). Use an absolute URL.
// The SSR guard (import.meta.env.SSR check) in beforeLoad prevents actual calls.
const baseURL = import.meta.env.SSR
	? "http://localhost:3000/api/auth"
	: apiUrl("/api/auth");

export const authClient = createAuthClient({
	baseURL,
});
