import { Paperclip, Send, Sparkles, X } from "lucide-solid";
import type { Component } from "solid-js";

/**
 * ComposeOverlay — prototype-faithful "New message" / "Reply" overlay.
 *
 * Recreates the prototype's `.overlay` > `.compose-card` composition:
 *   - `.compose-head`: title ("New message" or "Reply") + close button.
 *   - Three `.compose-field` rows: From (disabled), To, Subject.
 *   - `.compose-body`: a free-text message textarea.
 *   - `.compose-foot`: Attach / Suggest reply on the left; Discard / Send on
 *     the right.
 *
 * Everything is LOCAL/DEMO-ONLY: no mail is sent, no field is persisted, and
 * Send / Discard simply close the overlay. Clicking the dim backdrop or the
 * close / Discard controls dismisses it. The card stops click propagation so
 * interacting inside it never closes the overlay.
 */
export const ComposeOverlay: Component<{
	onClose: () => void;
	/** When set, the overlay renders as a Reply with a prefilled recipient. */
	replyTo?: string;
}> = (props) => {
	return (
		<div
			class="overlay"
			data-testid="compose-overlay"
			role="dialog"
			aria-modal="true"
			aria-label={props.replyTo ? "Reply" : "New message"}
			onClick={() => props.onClose()}
			onKeyDown={(e) => {
				if (e.key === "Escape") props.onClose();
			}}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss pattern; inner card stops propagation */}
			<div
				class="compose-card"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div class="compose-head">
					<h3>{props.replyTo ? "Reply" : "New message"}</h3>
					<button
						type="button"
						class="btn icon ghost"
						data-testid="compose-close"
						aria-label="Close compose"
						onClick={() => props.onClose()}
					>
						<X size={16} stroke-width={2.5} />
					</button>
				</div>

				<div class="compose-field">
					<label for="compose-from">From</label>
					<input id="compose-from" value="rob@hay.co" disabled />
				</div>
				<div class="compose-field">
					<label for="compose-to">To</label>
					<input
						id="compose-to"
						value={props.replyTo ?? ""}
						placeholder="Recipient"
					/>
				</div>
				<div class="compose-field">
					<label for="compose-subject">Subject</label>
					<input
						id="compose-subject"
						placeholder="Subject"
						value={props.replyTo ? "Re: Q3 hiring plan — final review" : ""}
					/>
				</div>

				<div class="compose-body">
					<textarea
						placeholder="Write your message…"
						value={
							props.replyTo
								? "Priya — \n\nQuick replies inline:\n\n1. Pod A: the seventh req moved to pod C in March when we restructured. Will pull the doc and confirm before our 1:1.\n\n2. Moving design forward by six weeks works for me if recruiting can backfill the platform req we'd planned for that slot."
								: ""
						}
					/>
				</div>

				<div class="compose-foot">
					<div class="row gap-8">
						<button type="button" class="btn sm" data-testid="compose-attach">
							<Paperclip size={14} stroke-width={2.5} />
							<span>Attach</span>
						</button>
						<button type="button" class="btn sm" data-testid="compose-suggest">
							<Sparkles size={14} stroke-width={2.5} />
							<span>Suggest reply (off)</span>
						</button>
					</div>
					<div class="row gap-8">
						<button
							type="button"
							class="btn sm"
							data-testid="compose-discard"
							onClick={() => props.onClose()}
						>
							Discard
						</button>
						<button
							type="button"
							class="btn sm primary"
							data-testid="compose-send"
							onClick={() => props.onClose()}
						>
							<Send size={14} stroke-width={2.5} />
							<span>Send</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
