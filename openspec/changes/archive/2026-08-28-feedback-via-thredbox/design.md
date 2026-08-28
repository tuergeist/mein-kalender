## Context

`routes/feedback.ts` authenticates the caller and posts a task to Todoist with a project id, two section ids and a label written into the source. Nothing is persisted here. The response is `{success: true}`, the dialog in `components/AppShell.tsx` closes after 1.5 seconds, and the report is gone from our side.

thredbox (`../thredbox`) turns one report into one Slack thread and pushes what happens there back to the originating app. HeyKurt (`../heykurt`) moved from Todoist to thredbox on 2026-08-25; its client lives in `backend/app/services/thredbox.py` and its webhook in `backend/app/api/feedback.py`. The contract read from both:

- `POST {api_url}/v1/tickets`, header `X-App-Key`, body `{message, type, meta}`. The first line of `message` becomes the Slack subject. The response carries `ticket_id`, `token`, `status`, `status_text`.
- The app must list the type in `allowed_ticket_types`, otherwise thredbox answers 422.
- Events arrive as `X-Thredbox-Event-Type` of `status_changed` or `message_created`, with `X-Thredbox-Event-Id` and an HMAC-SHA256 signature in `X-Thredbox-Signature` as `sha256=<hex>` over the raw body.
- Ticket status is one of `new`, `in_progress`, `waiting_for_user`, `resolved`, `rejected`.
- `GET /v1/tickets/{ticket_id}` returns the ticket against its token.

## Goals / Non-Goals

**Goals:**
- A reporter can see what became of their report without leaving the app
- A report is never lost because the ticket system was unreachable
- A missed webhook does not leave a report permanently stale
- An event cannot be faked, replayed, or applied out of order

**Non-Goals:**
- Letting the reporter reply into the thread. Reading the answer is the whole of this change; a two-way conversation is separate work
- Migrating existing Todoist tasks
- Attachments on a report
- Using thredbox for anything other than in-app feedback

## Decisions

### Store first, then send

The report is written to our database before the ticket call, and the call result is written back. Ticket creation is best-effort: a failure leaves a stored report with no ticket id, which the reconciliation pass can pick up later.

The reverse order — send, then store — loses the report whenever thredbox is down or rate-limits us, which is precisely when someone is most likely to be reporting something.

### The `/v1` prefix belongs to the client, not to the configured URL

`THREDBOX_API_URL` holds the host only; the client appends `/v1`. HeyKurt found the failure mode and commented it: without the prefix the call lands on thredbox's own web interface and returns 404. Because ticket creation is best-effort, that produces a stored report whose ticket silently never exists. The prefix is part of the contract this client implements, not an operator setting.

### Both hourly quotas have to be raised, and the per-IP one is the binding constraint

thredbox counts `max_tickets_per_hour_per_key` per app and `max_tickets_per_hour_per_ip` across **all** apps by `Ticket.client_ip`. Both default to 5. We call server-to-server, so every ticket we create carries the same cluster egress address, and the per-IP counter is the one that runs out first — after five reports an hour, regardless of the app quota. Both are settable on the app.

### The reporter's identity goes into `meta`

thredbox renders `meta` as fields on the Slack message. Putting the reporter, their account and the report id there means whoever opens the thread sees who is asking without reading the description, and the description stays the reporter's own words.

### Events are authenticated, deduplicated and ordered

Three independent checks, all required before an event is applied:

1. The **signature** verifies as HMAC-SHA256 over the raw request body. Fastify's JSON parser discards those bytes and a re-serialized payload can differ in key order or separators, so the route keeps the raw buffer through its own content-type parser — the same shape already used by the inbound-mail webhook.
2. The **event id** has not been seen. Providers retry, and a retried delivery must not overwrite anything.
3. The event's **`occurred_at` is newer** than the last applied event of that kind for that ticket, tracked separately for status and for messages.

HeyKurt's diary records why the third check is not enough on its own: their first duplicate test passed even with deduplication removed, because the retry carried the same `occurred_at` and the ordering comparison discarded it anyway. Deduplication earns its place only where the timestamp is absent or unreadable — then ordering cannot decide, and a retry would replace a newer answer with an older one. The tests here are written against that case.

### Reconciliation closes the gap the webhook leaves

thredbox gives up on a webhook after about fourteen minutes. HeyKurt stores the ticket token but never uses it, and lists that as an open item. Doing it from the start is cheap: a periodic pass takes reports that are not in a final state and whose last event is older than the retry window, reads `GET /v1/tickets/{id}` with the stored token, and applies the result through the same path as an event.

Without it, a deploy or a brief outage during those fourteen minutes leaves a report showing a status that will never change again.

### Status is mapped, not stored raw

thredbox's five values are stored as our own set so the display does not depend on their vocabulary. `waiting_for_user` is kept as a distinct value rather than folded into something like "acknowledged": HeyKurt found that collapsing it tells the reporter their report was noted while the thread is in fact waiting for an answer from them.

### Todoist goes rather than staying alongside

Two destinations for one report means both have to be watched, and the one without a return path would quietly become the one nobody reads. Existing Todoist tasks stay where they are; they are few and finite.

## Risks / Trade-offs

- **thredbox unreachable when a report is made.** Mitigation: the report is stored first and the ticket is created later by the reconciliation pass, which also covers reports whose creation failed.
- **Rate limit reached** — a burst of reports, or another app on the same cluster address exhausting the shared per-IP quota. Mitigation: raise both quotas on the app; a rejected creation leaves a stored report to retry, not a lost one.
- **Webhook secret leaks.** Mitigation: it authenticates events only; the worst case is a forged status on a report, not access to data. Rotatable on both sides without code changes.
- **The reporter sees an agent's reply written for Slack**, not for them. Accepted: the same is true in HeyKurt, and an answer in the wrong register beats no answer.
- **Reconciliation and a late webhook race.** Mitigation: both go through the same apply path with the same ordering comparison, so whichever arrives second and is older is discarded.
- **Reports accumulate with no retention rule.** Accepted for now; the volume is small and the reporter's own history is the point.

## Open Questions

- Whether a reporter should be notified by email when their report reaches a final state, or whether seeing it in the app is enough.
