// Atlas — account filter for the unified mail views.
//
// The category lists (Inbox / Feed / Paper Trail / Spam) are unified across
// every connected account. This compact `<select>` narrows the active list to
// one connected account, or "All accounts" for the unified cross-account view.
// It only renders once the user has more than one connected account — with a
// single account there is nothing to filter.
//
// Rendered as a small mono token in the list header (DESIGN.md — coded chrome
// stays compact). The selected value drives the `accountId` accessor on
// `useMailList`, so the list refetches scoped to that account.

import type { Component } from "solid-js";
import { Show } from "solid-js";
import { listAccountFilterClasses } from "../../lib/atlas/component_classes";
import { useConnectedAccounts } from "../../lib/identity/queries";

export interface MailAccountFilterProps {
	/** Selected connected-account id, or undefined for "All accounts". */
	value: string | undefined;
	/** Notify on change; undefined means the "All accounts" option. */
	onChange: (accountId: string | undefined) => void;
}

const MailAccountFilter: Component<MailAccountFilterProps> = (props) => {
	const accounts = useConnectedAccounts();
	const list = () => accounts.data?.accounts ?? [];

	return (
		<Show when={list().length > 1}>
			<select
				class={listAccountFilterClasses}
				aria-label="Filter by account"
				value={props.value ?? ""}
				onChange={(e) => {
					const v = e.currentTarget.value;
					props.onChange(v === "" ? undefined : v);
				}}
			>
				<option value="">All accounts</option>
				{list().map((account) => (
					<option value={account.id}>{account.email}</option>
				))}
			</select>
		</Show>
	);
};

export { MailAccountFilter };
