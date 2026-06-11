// Atlas — shared Solid state provider.
//
// Owns the full Atlas interaction model (`AtlasState`) in a TanStack Store and
// exposes it through Solid context so it persists across SPA route changes.
// Mounted once at the router root (`routes/__root.tsx`) above `<Outlet />`.
//
// Pure transitions live in `app_state.ts`; this module wires them into typed
// store actions. Components read reactive state via `useAtlasState()` and
// dispatch via `useAtlasActions()` — both throw outside an `<AtlasProvider>`.

import { Store, useStore } from "@tanstack/solid-store";
import {
	type Accessor,
	type ParentComponent,
	createContext,
	useContext,
} from "solid-js";
import {
	acceptScreener,
	createInitialState,
	rejectScreener,
	selectInView,
} from "./app_state";
import type { AiCategory, AtlasState, Screen } from "./types";

// ---------------------------------------------------------------------------
// Store + actions
// ---------------------------------------------------------------------------

/** Typed action surface exposed by the provider. */
export type AtlasActions = {
	// --- View / onboarding -------------------------------------------------
	/** Set the active screen. */
	setView(view: Screen): void;
	/** Advance / set the onboarding step. */
	setOnboardingStep(step: number): void;
	/** Mark onboarding complete. */
	completeOnboarding(): void;

	// --- Screener decisions ------------------------------------------------
	/** Accept screener item `sid` into `category` (clears any prior reject). */
	accept(sid: string, category: AiCategory): void;
	/** Reject screener item `sid` (clears any prior accept). */
	reject(sid: string): void;

	// --- Mail selection ----------------------------------------------------
	/** Select mail `id` within the current `view`'s category list. */
	select(view: Screen, id: string): void;

	// --- Handling-state toggles --------------------------------------------
	/** Toggle the "set aside" flag for mail `id`. */
	toggleSetAside(id: string): void;
	/** Toggle the "reply later" flag for mail `id`. */
	toggleReplyLater(id: string): void;

	// --- Compose overlay ---------------------------------------------------
	/** Open a blank "New message" compose. */
	openCompose(): void;
	/** Open a "Reply" compose prefilled with `replyAddr`. */
	openReply(replyAddr: string): void;
	/** Close the compose overlay. */
	closeCompose(): void;

	// --- Assistant overlay -------------------------------------------------
	/** Open the Ask Atlas assistant overlay. */
	openAssistant(): void;
	/** Close the Ask Atlas assistant overlay. */
	closeAssistant(): void;

	// --- Citation selection ------------------------------------------------
	/** Record the cited mail `id` selected from an assistant citation. */
	selectCitation(id: string): void;
	/** Clear the active citation selection. */
	clearCitation(): void;

	// --- Overlays ----------------------------------------------------------
	/** Dismiss any open overlay (compose + assistant). */
	dismissOverlays(): void;
};

/** A TanStack {@link Store} of {@link AtlasState} with bound {@link AtlasActions}. */
export type AtlasStore = Store<AtlasState, AtlasActions>;

/**
 * Construct a fresh Atlas store with its actions bound. A new instance is made
 * per provider so the store is request-isolated under SSR and never leaks state
 * between sessions.
 */
export function createAtlasStore(
	initial: AtlasState = createInitialState(),
): AtlasStore {
	return new Store<AtlasState, AtlasActions>(initial, (store) => ({
		setView: (view) => store.setState((s) => ({ ...s, view })),

		setOnboardingStep: (step) =>
			store.setState((s) => ({ ...s, onbStep: step })),

		completeOnboarding: () =>
			store.setState((s) => ({ ...s, onboarded: true })),

		accept: (sid, category) =>
			store.setState((s) => ({
				...s,
				screener: acceptScreener(s.screener, sid, category),
			})),

		reject: (sid) =>
			store.setState((s) => ({
				...s,
				screener: rejectScreener(s.screener, sid),
			})),

		select: (view, id) =>
			store.setState((s) => ({
				...s,
				selected: selectInView(view, s.selected, id),
			})),

		toggleSetAside: (id) =>
			store.setState((s) => ({
				...s,
				setAside: { ...s.setAside, [id]: !s.setAside[id] },
			})),

		toggleReplyLater: (id) =>
			store.setState((s) => ({
				...s,
				replyLater: { ...s.replyLater, [id]: !s.replyLater[id] },
			})),

		openCompose: () =>
			store.setState((s) => ({
				...s,
				compose: { mode: "new", replyAddr: "" },
			})),

		openReply: (replyAddr) =>
			store.setState((s) => ({
				...s,
				compose: { mode: "reply", replyAddr },
			})),

		closeCompose: () =>
			store.setState((s) => ({
				...s,
				compose: { mode: "closed", replyAddr: "" },
			})),

		openAssistant: () => store.setState((s) => ({ ...s, assistantOpen: true })),

		closeAssistant: () =>
			store.setState((s) => ({ ...s, assistantOpen: false })),

		selectCitation: (id) => store.setState((s) => ({ ...s, citation: id })),

		clearCitation: () => store.setState((s) => ({ ...s, citation: null })),

		dismissOverlays: () =>
			store.setState((s) => ({
				...s,
				compose: { mode: "closed", replyAddr: "" },
				assistantOpen: false,
			})),
	}));
}

// ---------------------------------------------------------------------------
// Context + provider
// ---------------------------------------------------------------------------

const AtlasStoreContext = createContext<AtlasStore>();

export interface AtlasProviderProps {
	/** Optional initial state (e.g. seeded by a route loader / test). */
	initialState?: AtlasState;
	/** Optional pre-built store (primarily for tests). */
	store?: AtlasStore;
}

/**
 * Provides the shared Atlas store to its subtree. Mount once at the router root
 * so the interaction state survives client-side route changes.
 */
export const AtlasProvider: ParentComponent<AtlasProviderProps> = (props) => {
	const store = props.store ?? createAtlasStore(props.initialState);
	return (
		<AtlasStoreContext.Provider value={store}>
			{props.children}
		</AtlasStoreContext.Provider>
	);
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useAtlasStore(): AtlasStore {
	const store = useContext(AtlasStoreContext);
	if (!store) {
		throw new Error(
			"Atlas state accessed outside <AtlasProvider>. Wrap the app (or the " +
				"relevant subtree) in <AtlasProvider> — it is mounted once at the " +
				"router root in routes/__root.tsx.",
		);
	}
	return store;
}

/**
 * Reactive read of the full Atlas state. Returns a Solid accessor; pass a
 * `selector` to subscribe to a narrower slice.
 *
 * @throws if called outside an {@link AtlasProvider}.
 */
export function useAtlasState(): Accessor<AtlasState>;
export function useAtlasState<TSelected>(
	selector: (state: AtlasState) => TSelected,
): Accessor<TSelected>;
export function useAtlasState<TSelected = AtlasState>(
	selector?: (state: AtlasState) => TSelected,
): Accessor<TSelected> {
	const store = useAtlasStore();
	return useStore(store, selector ?? ((s) => s as unknown as TSelected));
}

/**
 * The typed action dispatchers for the Atlas store.
 *
 * @throws if called outside an {@link AtlasProvider}.
 */
export function useAtlasActions(): AtlasActions {
	return useAtlasStore().actions;
}
