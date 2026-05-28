/**
 * Type declarations for Tauri plugin APIs.
 *
 * These modules are only available at runtime inside the Tauri desktop shell.
 * They are externalized in vite.config.ts so the web build succeeds.
 * The `isDesktop()` guard ensures they are never called in web builds.
 */

declare module "@tauri-apps/plugin-opener" {
	export function open(url: string): Promise<void>;
}

declare module "@tauri-apps/api/event" {
	export type UnlistenFn = () => void;
	export type EventCallback<T> = (event: { payload: T }) => void;
	export function listen<T>(
		event: string,
		handler: EventCallback<T>,
	): Promise<UnlistenFn>;
}

declare module "@tauri-apps/api/core" {
	export function invoke<T>(
		cmd: string,
		args?: Record<string, unknown>,
	): Promise<T>;
}
