import { createForm } from "@tanstack/solid-form";

/**
 * Minimal TanStack Form demo component.
 * Demonstrates createForm + Field with no network side effects.
 */
export function FormDemo() {
	const form = createForm(() => ({
		defaultValues: {
			greeting: "",
		},
		onSubmit: ({ value }) => {
			// No-op: just logs to console for demo purposes
			console.log("Form submitted:", value);
		},
	}));

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				void form.handleSubmit();
			}}
			class="flex flex-col gap-3"
		>
			<form.Field name="greeting">
				{(field) => (
					<div class="flex flex-col gap-1">
						<label for={field().name} class="text-sm font-medium text-zinc-400">
							Greeting
						</label>
						<input
							id={field().name}
							name={field().name}
							value={field().state.value}
							onBlur={() => field().handleBlur()}
							onInput={(e) => field().handleChange(e.currentTarget.value)}
							placeholder="Type a greeting…"
							class="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				)}
			</form.Field>

			<form.Subscribe
				selector={(state) => ({
					canSubmit: state.canSubmit,
					isSubmitting: state.isSubmitting,
				})}
			>
				{(state) => (
					<button
						type="submit"
						disabled={!state().canSubmit}
						class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
					>
						{state().isSubmitting ? "Submitting…" : "Submit"}
					</button>
				)}
			</form.Subscribe>
		</form>
	);
}
