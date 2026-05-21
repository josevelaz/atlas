# Use a provider mutation journal

The app records provider-backed actions in a provider mutation journal for reconciliation and error recovery. In the MVP, provider-backed actions are limited to sending replies and new messages; read/unread, archive, and trash/delete are excluded because they are app-owned Atlas states and do not mutate Gmail or Outlook.
