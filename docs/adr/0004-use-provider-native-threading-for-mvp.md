# Use provider-native threading for MVP

The MVP uses Gmail and Outlook's native conversation/thread grouping rather than building an app-owned mail threading engine. This keeps launch complexity lower and aligns with each connected account's existing mailbox behavior, at the cost of possible inconsistencies between providers. App-owned threading can be revisited if those inconsistencies become a product problem. Feed/newsletter items also use provider-native threading in the MVP, even though a future product refinement may treat newsletter issues as individual feed items.
