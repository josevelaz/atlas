import { QueryClient } from "@tanstack/solid-query";

/**
 * Shared QueryClient instance for the application.
 * Configured with sensible defaults for an SPA.
 */
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60, // 1 minute
			retry: 1,
		},
	},
});
