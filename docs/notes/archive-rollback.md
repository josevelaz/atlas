# Archive Behavior

Archive remains a manual app-owned action. Archiving in Atlas does not archive, move, label, or otherwise mutate the connected Gmail/Outlook account.

The AI Assistant does not propose or execute archive actions in the MVP.

Manual archive supports:

- **Single-thread archive** — immediately removes the thread from active Atlas category views.
- **User-selected bulk archive** — the user selects multiple threads, confirms the action, and Atlas removes the selected threads from active category views.

Bulk archive confirmation shows the selected thread count and an expandable list of selected thread subjects/senders before the app-owned archive state changes.

Archive does not mutate category, handling states, AI summary, AI priority, sender routing, or provider mailbox state. It only changes active visibility in Atlas. Restoring an archived thread preserves the thread's existing app-owned organization state.

Undo archive is an app-owned undo. If the user clicks Undo within the short undo window, Atlas clears the app-owned archived visibility state and returns the thread to its prior Atlas view. No provider rollback is required because no provider mutation occurred.

Because archive is app-owned, provider execution retry, provider restore state, and provider archive reconciliation are not needed for archive. Provider reconciliation should not treat a Gmail/Outlook archive state as authoritative for Atlas archive state.
