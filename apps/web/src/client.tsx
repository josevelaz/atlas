/// <reference types="vite/client" />
import { StartClient, hydrateStart } from "@tanstack/solid-start/client";
import { hydrate } from "solid-js/web";

/*
 * Solid's `hydrate()` expects `globalThis._$HY` — an object normally
 * injected by `renderToStream`.  When the page has no async data (no
 * Suspense / createResource), Solid's SSR omits the bootstrap script and
 * `_$HY` stays `undefined`.  `hydrate()` then crashes on its first line:
 *   `Cannot read properties of undefined (reading 'done')`
 *
 * The stub below mirrors what Solid's SSR would emit, including the
 * delegated-event queue that captures clicks arriving before hydration
 * completes.  Solid replays queued events once hydration finishes.
 */

interface HydrationContext {
	events: Array<[Element, Event]>;
	completed: WeakSet<Element>;
	r: Record<string, unknown>;
	fe: () => void;
	done?: boolean;
}

declare global {
	var _$HY: HydrationContext | undefined;
}

if (!globalThis._$HY) {
	const find_hk = (n: Node | null): Element | null => {
		if (!n || !("hasAttribute" in n)) return null;
		const el = n as Element;
		if (el.hasAttribute("data-hk")) return el;
		const host = (el as unknown as { host?: Node }).host;
		return find_hk(host?.nodeType ? host : el.parentNode);
	};

	const hy: HydrationContext = {
		events: [],
		completed: new WeakSet(),
		r: {},
		fe() {},
	};

	for (const evt of ["click", "input"] as const) {
		document.addEventListener(evt, (e) => {
			if (!hy.events) return;
			const t = find_hk((e.composedPath?.()[0] as Node) ?? (e.target as Node));
			if (t && !hy.completed.has(t)) hy.events.push([t, e]);
		});
	}

	globalThis._$HY = hy;
}

hydrateStart().then((router) => {
	hydrate(() => <StartClient router={router} />, document);
});
