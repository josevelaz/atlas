/**
 * API base URL — driven by the VITE_API_BASE_URL build-time env var.
 *
 * Vite exposes variables prefixed with `VITE_` to the client bundle via
 * `import.meta.env`. Set this variable per environment:
 *
 *   Local dev  → http://localhost:3000
 *   Staging    → https://<service>.ecs.us-east-1.on.aws  (ECS Express output)
 *   Production → https://<service>.ecs.us-east-1.on.aws  (ECS Express output)
 *   Preview    → https://<pr-service>.ecs.us-east-1.on.aws
 *
 * Falls back to an empty string so relative paths work in local dev when the
 * API server is proxied through the same origin.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Public wire contract for the anti-CSRF header expected by the API.
 *
 * Duplicated here intentionally rather than importing from the server app.
 */
export const ATLAS_CSRF_HEADER = "x-atlas-csrf";

/**
 * Build a full API URL from a path.
 *
 * @example
 *   apiUrl("/auth/session")  // → "https://…/auth/session"
 *   apiUrl("/health")        // → "/health"  (when API_BASE_URL is "")
 */
export function apiUrl(path: string): string {
	const base = API_BASE_URL.replace(/\/$/, "");
	const normalised = path.startsWith("/") ? path : `/${path}`;
	return `${base}${normalised}`;
}

const UNSAFE_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Shared API fetch wrapper.
 *
 * Always sends credentials and adds the anti-CSRF header for unsafe methods.
 */
export function apiFetch(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const method = (init.method ?? "GET").toUpperCase();
	const headers = new Headers(init.headers);

	if (UNSAFE_HTTP_METHODS.has(method)) {
		headers.set(ATLAS_CSRF_HEADER, "1");
	}

	return fetch(apiUrl(path), {
		...init,
		method,
		credentials: init.credentials ?? "include",
		headers,
	});
}
