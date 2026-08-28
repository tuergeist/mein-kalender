## Why

Feedback from the app becomes a Todoist task and then disappears. Nothing is stored on our side, so the reporter never learns whether their bug was fixed, their idea rejected, or their report even read. The dialog closes after 1.5 seconds and that is the end of it. Anyone who wants an answer has to write an email instead, which defeats the point of having a feedback button.

thredbox exists for exactly this: one report becomes one Slack thread, and every reply written in that thread travels back to the app. HeyKurt moved off Todoist onto it and has the loop closed.

## What Changes

- Reports are stored in our own database before anything is sent, so a report survives an outage at the ticket system
- A stored report opens a thredbox ticket; the reporter's identity travels in the ticket's `meta`, not in its text, so whoever picks up the Slack thread sees who asked without reading the description
- thredbox pushes status changes and agent replies back over a new signed webhook, and the reporter sees both in the app
- A reconciliation pass fetches the current state of tickets whose webhook never arrived, using the ticket token
- **BREAKING** Todoist is removed as the feedback destination. The hardcoded project and section ids go with it; existing Todoist tasks are not migrated

## Capabilities

### New Capabilities
- `feedback-tickets`: Storing a report, opening a thredbox ticket for it, receiving status and reply events back, reconciling missed events, and showing the reporter where their report stands

### Modified Capabilities
_(none — no existing spec covers the feedback route)_

## Impact

- **Backend**: `routes/feedback.ts` loses the Todoist call and gains persistence; new `lib/thredbox.ts` client; new webhook route at `/api/webhooks/thredbox`; a scheduled reconciliation job
- **Database**: new `feedback` table holding the report, the ticket id and token, the status, the latest reply, and the timestamps of the last applied events
- **Frontend**: the dialog in `components/AppShell.tsx` stays; a list of the reporter's own reports with status and reply is added
- **Configuration**: `THREDBOX_API_URL`, `THREDBOX_APP_KEY`, `THREDBOX_WEBHOOK_SECRET` replace `TODOIST_API_TOKEN` for this route
- **External setup**: a Slack channel and a registered thredbox app, with both hourly ticket quotas raised — the per-IP quota is counted across all apps and every server-to-server call carries the same cluster egress address
- **Removed**: `TODOIST_API_TOKEN` is no longer read by the feedback route
