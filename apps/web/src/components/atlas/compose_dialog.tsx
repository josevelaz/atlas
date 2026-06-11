// Atlas — compose overlay (new message + reply).
//
// Mirrors the prototype's `Compose` (`docs/prototype/screens.jsx`): a modal card
// with a header, borderless From / To / Subject compose-rows, a borderless body
// textarea, and a footer split between Attach / Suggest-reply (off) and
// Discard / Send. The topbar Compose button opens it as a blank "New message";
// the thread Reply button opens it as a "Reply" prefilled with the selected
// sender's address, a `Re:` subject, and a prototype reply draft.
//
// Open/close + reply target come from the shared Atlas store
// (`atlas_state.tsx`): the top-bar Compose button opens a blank "New message",
// the thread Reply button opens a "Reply" prefilled with the sender address.
// Closes via the header close button, backdrop click, Discard, or Escape — all
// routed through the shared `Dialog` primitive (`components/ui/dialog.tsx`).

import type { Component } from "solid-js";
import {
	composeBodyClasses,
	composeBodyTextareaClasses,
	composeCardClasses,
	composeFieldClasses,
	composeFieldInputClasses,
	composeFieldLabelClasses,
	composeFootClasses,
	composeHeadClasses,
	composeTitleClasses,
	gap8Classes,
	rowClasses,
} from "../../lib/atlas/component_classes";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input, Textarea } from "../ui/input";
import { AtlasIcon } from "./atlas_icon";

/** The signed-in user's own address — shown disabled in the From row. */
const FROM_ADDRESS = "rob@atlas.co";

/** Prototype reply draft, used when composing a reply (`docs/prototype`). */
const REPLY_DRAFT =
	"Priya — \n\nQuick replies inline:\n\n1. Pod A: the seventh req moved to pod C in March when we restructured. Will pull the doc and confirm before our 1:1.\n\n2. Moving design forward by six weeks works for me if recruiting can backfill the platform req we'd planned for that slot.";

/** Prototype reply subject, used when composing a reply. */
const REPLY_SUBJECT = "Re: Q3 hiring plan — final review";

export interface ComposeDialogProps {
	/** Whether the overlay is open. */
	open: boolean;
	/** Close the overlay (header ✕, backdrop, Discard, Escape). */
	onClose: () => void;
	/**
	 * Recipient address to prefill. When set, the overlay renders as a "Reply"
	 * (titled "Reply", with the `Re:` subject + draft body); when empty/undefined
	 * it renders as a blank "New message".
	 */
	replyTo?: string;
}

const ComposeDialog: Component<ComposeDialogProps> = (props) => {
	const isReply = () => Boolean(props.replyTo);
	const title = () => (isReply() ? "Reply" : "New message");
	const toValue = () => props.replyTo ?? "";
	const subjectValue = () => (isReply() ? REPLY_SUBJECT : "");
	const bodyValue = () => (isReply() ? REPLY_DRAFT : "");

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			class={composeCardClasses}
			aria-label={title()}
		>
			<div class={composeHeadClasses}>
				<h3 class={composeTitleClasses}>{title()}</h3>
				<Button
					size="sm"
					icon
					variant="ghost"
					onClick={props.onClose}
					aria-label="Close compose"
				>
					<AtlasIcon name="x" size={14} />
				</Button>
			</div>

			<div class={composeFieldClasses}>
				<label for="compose-from" class={composeFieldLabelClasses}>
					From
				</label>
				<Input
					id="compose-from"
					class={composeFieldInputClasses}
					value={FROM_ADDRESS}
					disabled
				/>
			</div>
			<div class={composeFieldClasses}>
				<label for="compose-to" class={composeFieldLabelClasses}>
					To
				</label>
				<Input
					id="compose-to"
					class={composeFieldInputClasses}
					value={toValue()}
					placeholder="Recipient"
				/>
			</div>
			<div class={composeFieldClasses}>
				<label for="compose-subject" class={composeFieldLabelClasses}>
					Subject
				</label>
				<Input
					id="compose-subject"
					class={composeFieldInputClasses}
					value={subjectValue()}
					placeholder="Subject"
				/>
			</div>

			<div class={composeBodyClasses}>
				<Textarea
					class={composeBodyTextareaClasses}
					placeholder="Write your message…"
					value={bodyValue()}
				/>
			</div>

			<div class={composeFootClasses}>
				<div class={cn(rowClasses, gap8Classes)}>
					<Button size="sm">
						<AtlasIcon name="attach" size={14} /> Attach
					</Button>
					<Button size="sm">
						<AtlasIcon name="sparkle" size={14} /> Suggest reply (off)
					</Button>
				</div>
				<div class={cn(rowClasses, gap8Classes)}>
					<Button size="sm" onClick={props.onClose}>
						Discard
					</Button>
					<Button size="sm" variant="primary">
						<AtlasIcon name="send" size={14} /> Send
					</Button>
				</div>
			</div>
		</Dialog>
	);
};

export { ComposeDialog };
