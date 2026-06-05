// Atlas — top-level app component for the inbox vertical slice.
//
// Wires the shell together: top bar, sidebar nav, and the mail workspace. Owns
// the view + screener-decision state. For this slice the view is fixed to
// "inbox" (the route owns it); the compose / assistant overlays land in later
// tasks, so their triggers are inert here rather than routing to placeholders.

import type { Component } from "solid-js";
import { createSignal } from "solid-js";
import { createInitialState } from "../../lib/atlas/app_state";
import type {
	Screen,
	ScreenerDecisions,
	ToggleSet,
} from "../../lib/atlas/types";
import { AppShell } from "./app_shell";
import { MailWorkspace } from "./mail_workspace";
import { SidebarNav } from "./sidebar_nav";
import { TopBar } from "./top_bar";

export interface AtlasAppProps {
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
	// Inbox slice: the view is fixed to "inbox" (route-bound). Screener
	// decisions stay empty here; later tasks own the screener flow.
	const [view] = createSignal<Screen>("inbox");
	const [decisions] = createSignal<ScreenerDecisions>(initial.screener);

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
					onSelect={noop}
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
