// Atlas — account provenance chip.
//
// Attributes a mail row or thread to the connected mailbox it was synced from.
// Always visible on server-backed rows and in the thread header so every
// thread is traceable to its source account in the unified (cross-account)
// views. Rendered as a small coded token (a bordered pill with a lilac dot +
// the account email in mono caps), per DESIGN.md — coded accents stay small,
// and AI-blue is reserved for the machine's voice, so this never uses it.
//
// A disconnected source swaps the dot to alarm-red and appends a "read only"
// suffix, marking the account read-only without hiding its retained threads.

import type { Component } from "solid-js";
import { Show } from "solid-js";
import {
	provenanceChipClasses,
	provenanceDotClasses,
	provenanceDotDisconnectedClasses,
	provenanceEmailClasses,
} from "../../lib/atlas/component_classes";
import type { MailProvenance } from "../../lib/atlas/types";
import { cn } from "../../lib/utils";

export interface ProvenanceChipProps {
	provenance: MailProvenance;
	/** Extra classes (e.g. sizing overrides in the thread header). */
	class?: string;
}

/** Whether a provenance's source account is disconnected (read-only). */
function isDisconnected(provenance: MailProvenance): boolean {
	return provenance.accountStatus === "disconnected";
}

const ProvenanceChip: Component<ProvenanceChipProps> = (props) => {
	const disconnected = () => isDisconnected(props.provenance);
	return (
		<span
			class={cn(provenanceChipClasses, props.class)}
			title={
				disconnected()
					? `${props.provenance.accountEmail} — disconnected (read only)`
					: props.provenance.accountEmail
			}
			data-account={props.provenance.connectedAccountId}
			data-disconnected={disconnected() ? "true" : undefined}
		>
			<span
				class={
					disconnected()
						? provenanceDotDisconnectedClasses
						: provenanceDotClasses
				}
				aria-hidden="true"
			/>
			<span class={provenanceEmailClasses}>
				{props.provenance.accountEmail}
			</span>
			<Show when={disconnected()}>
				<span class="opacity-70">· read only</span>
			</Show>
		</span>
	);
};

export { ProvenanceChip };
