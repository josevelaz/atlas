# Use provider push with reconciliation for sync

Atlas uses provider push/webhook events as the primary freshness trigger for mailbox sync, but the sync substrate remains trigger-agnostic and also runs periodic reconciliation every 5 minutes for active Connected Accounts. We chose this over poll-only sync because it delivers faster mailbox freshness without forcing Gmail and Outlook into one provider-specific trigger model, and we keep reconciliation because push delivery, subscription renewal, and callback handling are not reliable enough to be the only sync trigger.
