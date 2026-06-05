// Atlas — top-level app component for the mail workspace.
//
// Wires the shell together: top bar, sidebar nav, and the mail workspace. The
// active `view` and screener `decisions` are supplied by the route (they derive
// from the URL — path + `?d=` — so the screen and accepted-item counts are
// server-rendered correctly under the pre-existing broken-hydration constraint).
// Compose / assistant overlays land in later tasks, so their triggers are inert.

import type { Component } from "solid-js";
import { createInitialState } from "../../lib/atlas/app_state";
import type {
	Screen,
	ScreenerDecisions,
	ToggleSet,
} from "../../lib/atlas/types";
import { AppShell } from "./app_shell";
import { MailWorkspace } from "./mail_workspace";
import { SidebarNav, type SidebarNavProps } from "./sidebar_nav";
import { TopBar } from "./top_bar";

export interface AtlasAppProps {
	/** Active screen (route-bound). Defaults to "inbox". */
	view?: Screen;
	/** Screener decisions (decoded from the route's `?d=`). Defaults to empty. */
	decisions?: ScreenerDecisions;
	/** Resolve SSR-proof nav `<Link>` targets (carries the current `?d=`). */
	linkFor?: SidebarNavProps["linkFor"];
	/**
	 * Optional initial selected mail id (proof variants). Seeds the thread pane
	 * server-side so row selection is observable without client hydration.
	 */
	initialSelectedId?: string;
	/** Optional initial set-aside toggle map (proof variants). */
	initialSetAside?: ToggleSet;
	/** Optional initial reply-later toggle map (proof variants). */
	initialReplyLater?: ToggleSet;
}

const AtlasApp: Component<AtlasAppProps> = (props) => {
	const initial = createInitialState();
	const view = (): Screen => props.view ?? "inbox";
	const decisions = (): ScreenerDecisions =>
		props.decisions ?? initial.screener;

	// Overlay triggers are wired to no-ops until the compose / assistant
	// overlays ship in their own tasks. Keeping them silent avoids routing
	// users to incomplete placeholder screens.
	const noop = () => {};

	return (
		<AppShell
			topBar={<TopBar onSearch={noop} onCompose={noop} />}
			sidebar={
				<SidebarNav
					activeView={view()}
					decisions={decisions()}
					linkFor={props.linkFor}
				/>
			}
		>
			<MailWorkspace
				view={view()}
				decisions={decisions()}
				onCompose={noop}
				initialSelectedId={props.initialSelectedId}
				initialSetAside={props.initialSetAside}
				initialReplyLater={props.initialReplyLater}
			/>
		</AppShell>
	);
};

export { AtlasApp };
