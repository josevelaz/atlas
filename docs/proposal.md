# AI-managed Email Client Product Brief

## Working pitch

A smarter inbox for Gmail and Outlook that protects your attention with sender screening, clean categories, and AI-powered summaries, priorities, and tasks.

## Overview

This product is a personal email client for people who want the control and calm of a Hey-style inbox without leaving Gmail or Outlook. Users connect their existing Gmail/Google Workspace or Outlook/Microsoft 365 account, receive new mail through an opinionated screening and categorization layer, and send replies or new emails through their existing address.

The core product promise is protected attention. First-time senders are intercepted before they reach the Inbox. Accepted senders are routed into clear categories. The AI assistant helps triage by suggesting categories, summarizing threads, prioritizing what matters, extracting tasks and dates, and answering semantic search questions over synced mail.

The product is personal-first. It may later be sold into companies as a better individual inbox for employees, but the MVP does not include workspaces, team inboxes, admin controls, or shared collaboration.

## Target users

### Primary

- Individuals with high email volume who want stronger control over what reaches their attention.
- Newsletter-heavy users who want subscriptions separated from important mail.
- Professionals who need AI help identifying urgent threads, tasks, deadlines, and follow-ups.

### Later

- Companies that want to give employees a smarter individual inbox.
- Teams that may eventually need shared-inbox or collaboration workflows.

## Problem

Existing email clients treat most inbound mail as equally eligible for attention. Newsletters, receipts, automated notifications, and unknown senders compete with actual work and personal messages. Gmail and Outlook provide filters and folders, but these are often manual, provider-specific, and not designed around sender screening or AI-assisted triage.

Users need an email experience that answers three questions quickly:

1. Who is allowed to reach me?
2. What kind of mail is this?
3. What needs my attention or action now?

## Goals

- Give users a strong sender-level Screener for first-time senders.
- Separate mail into a small, opinionated set of categories: Inbox, Feed, and Paper Trail.
- Use AI to reduce triage effort without taking irreversible actions automatically.
- Work on top of existing Gmail and Outlook accounts.
- Feel like a fast, native-quality PWA with a neobrutalist visual identity.

## Non-goals

- Hosting email addresses or replacing Gmail/Outlook as the underlying provider.
- Importing and reorganizing historical mailbox content.
- Generic IMAP/SMTP support in MVP.
- Shared inboxes, team collaboration, workspaces, admin controls, or seat billing.
- AI-written replies or AI-composed new emails in MVP.
- Custom top-level categories in MVP.
- Provider-backed label/folder/category synchronization for app categories.

## MVP scope

### Connected accounts

- Support Gmail / Google Workspace.
- Support Outlook / Microsoft 365.
- Sync new mail only after account connection.
- Send replies and compose new mail through the connected account.
- Use provider-native threading for MVP.

### Screener

- New threads from unscreened exact sender email addresses land in the Screener.
- Screening decisions are scoped per connected account.
- User can **Accept** or **Reject** a sender.
- Accept uses a category dropdown: Inbox, Feed, or Paper Trail.
- Accept moves the current thread into the chosen category and creates a sender routing rule for future threads.
- Reject hides future threads from that sender inside the app without modifying Gmail/Outlook.
- Rejected senders are recoverable; users can later accept them and optionally restore hidden historical threads.
- If an unscreened sender replies inside an already accepted thread, the reply stays in that thread; that sender remains unscreened for future threads they initiate.

### Categories and handling states

Fixed categories:

- **Inbox** — important mail that demands attention.
- **Feed** — newsletters, marketing, announcements, and browse-later content.
- **Paper Trail** — receipts, confirmations, shipping notices, and reference records.

Handling states:

- **Set Aside** — come back later; does not necessarily require a reply.
- **Reply Later** — specifically requires a response.

Categories, read state, archive state, trash/delete state, and handling states are app-owned metadata. They do not modify Gmail/Outlook labels, folders, read status, archive state, trash state, or categories by default.

### Provider-backed actions

These actions sync to the connected account:

- Send reply
- Compose new email

Read/unread is app-owned: it tracks read state inside Atlas without changing read status in the connected provider. Archive is app-owned: it removes the thread from active app category views without archiving it in the connected provider. Trash/delete is app-owned: it removes the thread from normal Atlas views without moving it to provider trash or deleting it in the connected provider.

### AI assistant

The AI assistant is assistive, not fully autonomous.

MVP capabilities:

- Suggest categories for threads, including unscreened threads in the Screener.
- Summarize threads when viewed.
- Prioritize Inbox threads with sorting, visible badges, and explanations.
- Extract Tasks and Dates/Events from threads.
- Sync confirmed Tasks/Dates to the source account’s native task/calendar system:
  - Google Tasks / Google Calendar
  - Microsoft To Do / Outlook Calendar
- Provide semantic search over synced threads only.
- Return semantic search answers with cited source threads.
- Propose bulk commands for app-owned actions only, requiring user review and confirmation.

AI exclusions for MVP:

- No AI-written replies.
- No AI-composed new emails.
- No direct execution of archive, trash/delete, reject, or other high-risk bulk actions.
- No blanket analysis of the user’s entire mailbox.

### Search and assistant entry point

- One unified AI search/assistant entry point.
- Users can search, ask questions, and issue supported read-oriented commands.
- Semantic search only covers synced new-mail threads.
- Historical provider mailbox search is future scope.

### Notifications

- PWA notifications only for important Inbox activity, especially high-priority threads.
- Feed and Paper Trail do not notify by default.
- Screener items do not notify by default unless AI identifies the thread as potentially urgent or high priority.

### Onboarding

Flow:

1. Connect Gmail or Outlook/Microsoft 365.
2. Explain Screener, Inbox, Feed, Paper Trail, Set Aside, Reply Later, and AI assistant.
3. Explain that the MVP organizes new mail only and everyone starts unscreened.
4. Start screening new mail as it arrives.

Because the app starts with new mail only, empty states should include an interactive walkthrough. The MVP should not use a fake/demo mailbox.

### Platform and design

- Web app delivered as a PWA.
- Native-like feel with responsive layouts, installability, and polished transitions.
- Desktop layout: three-pane email client.
- Mobile/PWA layout: two-pane drill-in flow.
- UI foundation: neobrutalism.dev React/Tailwind components.
- Visual direction: neobrutalist with hard borders, offset shadows, bold typography, and the provided Tailwind/OKLCH token system.
- Motion style: tactile brutalist motion — pressable buttons, shadow/translate feedback, quick geometric panel transitions, and view transitions where useful.
- Must respect `prefers-reduced-motion`.

## Business model

Working model: freemium with paid individual subscription upgrades.

Free tier:

- One connected account.
- Limited AI usage.
- Core Screener and category workflow.

Paid tier candidates:

- Multiple connected accounts.
- Higher AI usage limits.
- More semantic search capacity.
- Advanced automation.
- Future third-party integrations.

B2B sales may be explored later, but the MVP is not built around company workspaces or seat-based billing.

## Success metrics

Product activation:

- % of users who connect an account successfully.
- % of users who screen their first sender.
- % of users who accept/reject at least five senders.
- Time from signup to first meaningful categorized thread.

Engagement:

- Weekly active users.
- Threads screened per active user.
- AI summaries viewed per active user.
- AI action items confirmed per active user.
- Semantic searches per active user.

Quality:

- Category suggestion acceptance rate.
- Priority badge helpfulness feedback.
- Action extraction confirmation rate.
- Notification open/dismiss ratio.

Business:

- Free-to-paid conversion rate.
- Paid retention.
- Multi-account upgrade rate.
- AI usage relative to subscription cost.

Guardrails:

- OAuth connection failure rate.
- Sync latency and failure rate.
- AI cost per active user.
- User-reported privacy/trust concerns.
- Wrongly hidden/rejected sender recovery events.

## Risks and tradeoffs

- **New-mail-only onboarding may feel empty.** The product must explain clearly that organization begins after connection.
- **AI trust is fragile.** AI suggestions need confirmation for category changes and action creation.
- **Provider integrations are complex.** Gmail and Outlook differ in threading, sync semantics, quotas, and OAuth review requirements.
- **PWA notifications may be inconsistent across platforms.** Native apps may eventually be needed for best mobile behavior.
- **Neobrutalist UI can become noisy.** The design should stay information-dense and readable, not decorative for its own sake.
- **Action sync expands scope.** Google Tasks/Calendar and Microsoft To Do/Outlook Calendar are valuable but add integration complexity.

## Future scope

- Generic IMAP/SMTP support.
- Historical mailbox import and semantic search.
- Configurable third-party task destinations such as Todoist, Apple Reminders, Notion, and Linear.
- Optional provider label/folder sync-back.
- Custom tags or secondary labels.
- AI reply drafting and compose assistance.
- Native iOS, Android, and desktop apps.
- Workspaces, shared inboxes, team rules, assignments, comments, and admin controls.

## Recommendation

Build the MVP as a personal-first PWA on top of Gmail and Outlook. Keep the category model fixed and opinionated, keep AI assistive and confirmation-driven, and make the Screener the central product habit. The clearest wedge is not “AI writes your email”; it is “AI protects your attention and tells you what matters.”
