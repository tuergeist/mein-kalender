## 1. thredbox side

- [ ] 1.1 Create a Slack channel for mein-kalender reports and note its channel id
- [ ] 1.2 Register the app: `make create-app name="Mein Kalender" channel=<id> args="--language de"` with `allowed_ticket_types` covering `bug` and `feature` — thredbox answers 422 for a type the app does not list, and creation is best-effort, so the report would be stored with no ticket
- [ ] 1.3 Raise `max_tickets_per_hour_per_key` **and** `max_tickets_per_hour_per_ip` on the app; both default to 5, and the per-IP counter runs across all apps on the cluster's egress address, so it is the one that runs out first
- [ ] 1.4 Set the app's webhook URL to `https://app.mein-kalender.link/api/webhooks/thredbox` and generate its secret
- [ ] 1.5 Record `public_key` and webhook secret; no allowed origin is needed, the call is server-to-server

## 2. Configuration

- [ ] 2.1 Add `THREDBOX_API_URL` (host only, no version), `THREDBOX_APP_KEY` and `THREDBOX_WEBHOOK_SECRET` to `.env.example` and the k8s secret
- [ ] 2.2 Extend `lib/env.ts` with an optional-group check so a half-configured state fails at startup instead of silently skipping ticket creation
- [ ] 2.3 Leave `TODOIST_API_TOKEN` in place until the rollout is done, then remove it from the secret

## 3. Data model

- [ ] 3.1 Add a `Feedback` model to `prisma/schema.prisma`: `userId`, `type`, `title`, `description`, `status`
- [ ] 3.2 Add the ticket fields: `thredboxTicketId` (unique, indexed — every incoming event is looked up by it), `thredboxTicketToken`
- [ ] 3.3 Add `statusEventAt` and `messageEventAt` as separate columns; the two event kinds are ordered independently
- [ ] 3.4 Add `latestReply` and `createdAt`/`updatedAt`
- [ ] 3.5 Add storage for applied event ids, for deduplication
- [ ] 3.6 Create and apply the migration

## 4. Outbound

- [ ] 4.1 Add `lib/thredbox.ts` with `createTicket({message, type, meta})` posting to `${THREDBOX_API_URL}/v1/tickets` with an `X-App-Key` header — the `/v1` belongs in the client, not in the configured URL, or the call lands on thredbox's own web interface and returns 404
- [ ] 4.2 Add `getTicket(ticketId, token)` for reconciliation
- [ ] 4.3 Add `verifyEventSignature(rawBody, header, secret)` as HMAC-SHA256 compared in constant time
- [ ] 4.4 Add the thredbox status to internal status mapping, keeping `waiting_for_user` as its own value rather than folding it into an acknowledged-like state
- [ ] 4.5 Rewrite `routes/feedback.ts`: store the report first, then create the ticket, then write the ticket id, token and status back
- [ ] 4.6 Put the title on the first line of the ticket message and the reporter, their account and the report id into `meta`
- [ ] 4.7 Confirm receipt to the reporter even when ticket creation failed
- [ ] 4.8 Remove the Todoist call and its hardcoded project and section ids
- [ ] 4.9 Add `GET /api/feedback` returning only the caller's own reports

## 5. Inbound

- [ ] 5.1 Add `routes/thredbox-webhook.ts` with a public POST at `/api/webhooks/thredbox`, registered in `server.ts`
- [ ] 5.2 Give the route its own content-type parser that keeps the raw body buffer; the default JSON parser discards the bytes the signature covers, and a re-serialised payload can differ in key order
- [ ] 5.3 Set an explicit body limit and a per-route rate-limit allowance so retries are not answered with 429
- [ ] 5.4 Reject when no webhook secret is configured, rather than accepting unverified events
- [ ] 5.5 Verify the signature before parsing anything
- [ ] 5.6 Reject a request missing its ticket reference or event type as a bad request
- [ ] 5.7 Look the report up by ticket id; answer success and change nothing when it is unknown
- [ ] 5.8 Discard an event whose id has already been applied, answering success
- [ ] 5.9 Discard an event not newer than the last applied event of its kind for that report, comparing status and message events against their own columns
- [ ] 5.10 Apply `status_changed`: map the value, reject an unrecognised one, store the status and the event time
- [ ] 5.11 Apply `message_created`: store the reply text and the event time
- [ ] 5.12 Answer success for anything else so the sender stops retrying

## 6. Reconciliation

- [ ] 6.1 Add a scheduled job that selects reports in a non-final state whose last event is older than thredbox's retry window of roughly fourteen minutes
- [ ] 6.2 Read each ticket with its stored token and apply the result through the same path an event takes, including the ordering comparison
- [ ] 6.3 Include reports that have no ticket id at all and attempt creation for them
- [ ] 6.4 Skip reports in a final state
- [ ] 6.5 Log and leave unchanged a ticket that cannot be read
- [ ] 6.6 Register the job alongside the existing scheduled work

## 7. Frontend

- [ ] 7.1 Keep the submit dialog in `components/AppShell.tsx`; replace the fixed 1.5-second close with confirmation that the report was recorded
- [ ] 7.2 Add a list of the user's own reports with title, type, status and latest reply
- [ ] 7.3 Show a status distinctly when the ticket is waiting for the reporter
- [ ] 7.4 Distinguish "no reply yet" from "answered"
- [ ] 7.5 Reach the list from the account menu next to the existing feedback entry

## 8. Verification

- [ ] 8.1 A report is stored when the ticket system is unreachable, and the reporter still gets a confirmation
- [ ] 8.2 A report is stored when the ticket system answers with a rate-limit refusal
- [ ] 8.3 A too-short title is rejected and nothing is stored
- [ ] 8.4 An unauthenticated submission is rejected
- [ ] 8.5 The ticket message carries the title on its first line and the reporter in `meta`, not in the text
- [ ] 8.6 The client calls the `/v1` path even when the configured URL has none
- [ ] 8.7 The webhook rejects a missing, malformed and mismatched signature, and one computed over a different body
- [ ] 8.8 The webhook rejects everything when no secret is configured
- [ ] 8.9 A repeated event id changes nothing and answers success
- [ ] 8.10 An older event does not overwrite a newer status or reply
- [ ] 8.11 An event with no usable occurrence time is decided by its event id alone — this is the case where deduplication is load-bearing; verify the test fails when deduplication is removed
- [ ] 8.12 A status event and a reply event for the same report do not order against each other
- [ ] 8.13 An unrecognised status value is rejected
- [ ] 8.14 An unknown ticket id changes nothing and answers success
- [ ] 8.15 The report list returns only the caller's own reports
- [ ] 8.16 Reconciliation applies a newer state, discards an older one, skips final states, and creates a ticket for a report that has none
- [ ] 8.17 The webhook answers with a body when the client accepts gzip — a bare `reply.send()` in an async handler returns an empty body under `@fastify/compress`

## 9. Rollout

- [ ] 9.1 Deploy with thredbox unconfigured and confirm reports are stored and the dialog still works
- [ ] 9.2 Configure the credentials, submit a report, and confirm the Slack thread appears with the reporter in its fields
- [ ] 9.3 Change the ticket status in Slack and confirm it reaches the app
- [ ] 9.4 Reply in the thread and confirm the reporter sees the answer
- [ ] 9.5 Suppress the webhook for one ticket and confirm reconciliation catches it up
- [ ] 9.6 Submit more reports in an hour than the default quota allows, to confirm the raised limits took effect
- [ ] 9.7 Remove `TODOIST_API_TOKEN` from the secret
