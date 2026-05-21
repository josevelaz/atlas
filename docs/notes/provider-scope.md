# Provider Scope

## MVP

The MVP supports connected accounts from:

- Gmail / Google Workspace
- Outlook / Microsoft 365

Users can sync mail from these connected accounts and send mail through the connected account, so outgoing messages appear from the user's existing email address.

The MVP syncs these actions back to the connected account:

- Send reply / compose new email

The MVP keeps these as app-owned metadata only:

- Category
- Read/unread: tracks read state inside Atlas while leaving the connected Gmail/Outlook account unchanged.
- Archive: removes the thread from active category views in Atlas while leaving the connected Gmail/Outlook account unchanged.
- Trash/Delete: removes the thread from normal Atlas views while leaving the connected Gmail/Outlook account unchanged.
- Set Aside
- Reply Later
- AI priority
- AI summaries
- Extracted action items

Spam/report-sender flows and unsubscribe flows are deferred.

## Future

Future provider support should include generic IMAP/SMTP for users outside Gmail and Outlook/Microsoft 365.
