# Layout

## MVP

The app uses an adaptive email-client layout:

- Desktop: classic three-pane layout with navigation/categories on the left, thread list in the middle, and reading pane on the right.
- Mobile/PWA: two-pane drill-in layout optimized for triage, where users move between category/thread lists and focused thread detail views.

The layout should support unified cross-account views while preserving account filtering and account labels on threads.

The AI assistant is exposed through a prominent command/search bar and a contextual drawer or overlay for results, proposed actions, and explanations. AI outputs also appear inline where they matter: priority badges in thread lists, summaries in thread detail, and extracted action items near the source thread content.
