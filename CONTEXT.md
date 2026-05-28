# Context: Atlas Email Client

## Glossary

### Screener

A dedicated workflow for handling first-time senders. A sender is identified by exact email address. When an email arrives from an exact sender email address that has not been previously screened, it is intercepted and placed in the Screener instead of being delivered to any other bucket. The user makes a sender-level decision: **Accept** (the sender is assigned a default category, the current thread moves to that category, and future threads from this sender bypass the Screener) or **Reject** (future threads from this sender are hidden in the app without modifying the connected account). Rejected senders are recoverable: the user can view rejected senders, accept a rejected sender later, and optionally restore hidden historical threads from that sender. The Screener operates at **sender granularity** within a connected account — the decision applies to the sender for that connected account, not globally across all of the user's connected accounts and not to an individual email or thread. Screening applies to new threads initiated by an unscreened sender. If an unscreened sender replies inside an already-accepted thread, the reply remains in that thread and the sender remains unscreened for future threads they initiate.

### Thread

The primary object the user manages. A thread is a conversation made up of one or more email messages. Categories, handling states, AI priority, summaries, and extracted action items apply to threads by default. AI-generated summaries, priority explanations, and action item suggestions are cached for the current thread version and refreshed when the thread changes.

### Screening State

The thread-level lifecycle that captures a thread's Screener status independently of Category. A thread's Screening State determines whether it is pending review in the Screener, accepted into the normal category model, or hidden because its initiating sender was rejected.

### Category

A classification for accepted threads. Each thread lives in exactly one category. Categories are app-owned metadata and do not modify the connected account's folders, labels, or categories by default. The three primary categories are:

- **Inbox** — the important inbox. Personal, work, and any email that demands the user's attention.
- **Feed** — newsletters, marketing, announcements. Things the user browses, not things that demand attention.
- **Paper Trail** — receipts, confirmations, shipping notifications. Things the user might need to reference but does not need to read in the moment.

### Sender Routing Rule

A mapping from a screened sender to a default category within a connected account. Established when a sender is Accepted from the Screener using the Accept category dropdown. Future threads initiated by that sender in that connected account are routed to the assigned default category unless overridden.

### Email Identity

An exact email address associated with a sender or recipient. Screening and Sender Routing Rules operate on Email Identities at exact-email granularity within a connected account, not on broader person-level groupings.

### Per-Thread Override

An explicit recategorization of a single thread to a different category than the sender's default routing rule. This changes only the thread by default. After a per-thread override, the user may optionally update the sender routing rule so future threads from that sender use the new category.

### AI Assistant

A helper that supports email management without replacing the user's judgment. In the MVP, the AI Assistant can categorize threads, summarize threads, prioritize threads within a category, and extract action items from threads. The AI Assistant does not write replies or compose new emails in the MVP.

The AI Assistant uses an assistive autonomy model:

- It suggests category changes, including category suggestions for unscreened threads in the Screener, but the user confirms before the category changes.
- It may automatically summarize threads when the user views them.
- It may automatically prioritize threads within the Inbox by sorting them and showing a visible priority badge or explanation for high-priority items. A thread is high priority when it likely contains a direct request, deadline, time-sensitive coordination, or important sender relationship.
- It may automatically extract action items, but the user confirms before those become tasks, reminders, dates, events, or other commitments.
- It processes email content only when needed for enabled features, rather than analyzing the user's entire mailbox by default.
- It may propose command-driven bulk actions for app-owned actions only, but the user reviews and confirms before execution. The AI Assistant does not propose or execute archive actions in the MVP.

### Action Item

A suggestion extracted from a thread that represents something the user may need to act on or remember. Action items are split into **Tasks** (things the user may need to do) and **Dates/Events** (things the user may need to remember, schedule, or track). Extracted action items are suggestions until the user confirms them. Confirmed action items sync by default to the connected provider's native task or calendar system for the account that owns the source thread, and remain attached to the source thread in the app.

### Read State

An app-owned state indicating whether a thread has been read inside Atlas. Reading or marking a thread read/unread in Atlas does not modify the connected Gmail/Outlook account.

### Archive

An app-owned visibility state that removes a thread from active Atlas category views without modifying the connected Gmail/Outlook account. Archiving in Atlas does not change the thread's category, handling states, read state, AI summary, AI priority, sender routing, or provider mailbox state.

### Trash

An app-owned visibility state that removes a thread from normal Atlas views without moving it to trash or deleting it in the connected Gmail/Outlook account. Trashing in Atlas does not change provider mailbox state.

### Handling State

An overlay that describes what the user intends to do with a thread without changing the thread's category. Handling states are independent of categories. Handling states are app-owned metadata and do not modify the connected account's folders, labels, or categories by default.

The primary handling states are:

- **Set Aside** — the user wants to come back to the thread later, but the thread does not necessarily require a reply.
- **Reply Later** — the thread specifically needs a response from the user.

### User

A person who authenticates to Atlas and owns the app-level data, preferences, and connected accounts within the product.

### Connected Account

A third-party email account that the user authorizes the product to access. A Connected Account is specifically an email/mailbox concept, not a generic integration record for every external service. The product is a sync-only email client: it organizes mail from connected accounts rather than issuing or hosting new email addresses. The user can send replies and compose new emails through a connected account, so outgoing mail appears to come from the user's existing email address.

### Sync State

The durable per-Connected-Account record of sync progress. Sync State stores the current provider cursor and overall sync health for a Connected Account, and answers "where are we up to?" for future sync runs.

### Sync Job

An append-only record of one mailbox sync attempt for a Connected Account. A Sync Job captures the operational outcome of a run — such as timing, status, counts, errors, and starting cursor snapshot — and answers "what happened during this attempt?"

### Contact

A user-scoped person or entity representation that may group multiple Email Identities across the user's connected accounts. Contacts support Atlas's unified-by-default experience, but they do not change the exact-email routing model: screening and Sender Routing Rules still operate on Email Identities within a connected account.

### Destination Integration

A non-email external system that receives synced Atlas action items. A Destination Integration is distinct from a Connected Account: the Connected Account owns the source thread, while the Destination Integration is where a confirmed action item is synced after confirmation.

### Integration Mutation Journal

A unified journal of Atlas write operations to external systems. The Integration Mutation Journal records outbound mutations for reconciliation, retry, idempotency, and error recovery across both Connected Accounts and Destination Integrations.

### Unified View

A cross-account view that combines threads from all connected accounts into one experience. The product is unified by default, so the user sees one Inbox, one Feed, one Paper Trail, and one Screener across connected accounts. Threads remain associated with their connected account and can be filtered by account.

## Flagged ambiguities

- "Hay" vs "Atlas" was used inconsistently across repo assets — resolved: **Atlas** is the public product brand.
