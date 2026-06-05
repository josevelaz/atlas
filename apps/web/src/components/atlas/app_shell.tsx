// Atlas — application shell.
//
// The fixed three-region grid: a full-width top bar, the sidebar nav, and the
// active workspace (list + pane, or a full-width region). Mirrors the
// prototype's `.app` grid. Layout-only — all interaction state lives above.

import type { Component, JSX } from "solid-js";

export interface AppShellProps {
	topBar: JSX.Element;
	sidebar: JSX.Element;
	/** The workspace region: a `MailList` + `ThreadView` pair, or a full pane. */
	children: JSX.Element;
}

const AppShell: Component<AppShellProps> = (props) => {
	return (
		<div class="atlas-app" data-screen-label="Atlas app">
			{props.topBar}
			{props.sidebar}
			{props.children}
		</div>
	);
};

export { AppShell };
