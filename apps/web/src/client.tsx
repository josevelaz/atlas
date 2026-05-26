/// <reference types="vite/client" />
import { StartClient, hydrateStart } from "@tanstack/solid-start/client";
import { render } from "solid-js/web";

hydrateStart().then((router) => {
	render(() => <StartClient router={router} />, document);
});
