## 1. Mail authentication baseline

- [ ] 1.1 Send a test invitation from the relay as it stands today to a Proton address and record whether it is filtered — no domain of ours publishes SPF, DKIM or DMARC, so this is the baseline the rest of the change is measured against
- [ ] 1.2 Add SPF for `reply.mcal.ink` authorising the existing SMTP relay
- [ ] 1.3 Add a DKIM key for `reply.mcal.ink` and configure the relay to sign for it
- [ ] 1.4 Add a DMARC record for `reply.mcal.ink`; sender alignment on inbound replies depends on it being evaluable
- [ ] 1.5 Configure an explicit `Return-Path` for booking mail so bounces do not arrive at reply addresses
- [ ] 1.6 Repeat the delivery test as `reply.mcal.ink` and confirm SPF, DKIM and DMARC all pass at Proton and the message is not filtered

## 2. Inbound provider

- [ ] 2.1 Register the inbound account at EmailConnect.eu and create a domain for `reply.mcal.ink`
- [ ] 2.2 Add the MX records for `reply.mcal.ink` pointing at the provider
- [ ] 2.3 Confirm the provider reports a DMARC-aligned authenticated sender per message; if it does not, stop and revisit the provider choice, since the security model depends on it
- [ ] 2.4 Add `INBOUND_MAIL_DOMAIN` and `INBOUND_WEBHOOK_SECRET` to `.env.example` and to the k8s secret
- [ ] 2.5 Extend `lib/env.ts` with an optional-group check: both variables set or neither, failing startup on a half-configured state

## 3. Data model

- [ ] 3.1 Add `replyAddress String? @unique` to `Booking` — the full address, not just the token
- [ ] 3.2 Add `hostInvitationEmail String?` to `Booking`, written at invitation time, so replies can be matched without re-running calendar-source resolution
- [ ] 3.3 Add per-attendee response columns: `guestPartstat`, `guestRespondedAt`, `guestRepliedSequence`, `hostPartstat`, `hostRespondedAt`, `hostRepliedSequence` (all nullable — absence means outstanding)
- [ ] 3.4 Add storage for processed inbound message ids, for idempotency against provider retries
- [ ] 3.5 Create and apply the migration

## 4. Outbound: send from the reply address

- [ ] 4.1 Give `sendEmail` in `lib/email.ts` an optional `from`, defaulting to `SMTP_FROM` so existing callers are unchanged
- [ ] 4.2 Pass `from` through the email queue job payload to the worker
- [ ] 4.3 Add a helper that mints a token — 32 characters from `crypto.randomBytes` over `[A-Za-z0-9]`, matching the `IcsFeed.token` precedent — and returns the full address, or null when `INBOUND_MAIL_DOMAIN` is unset
- [ ] 4.4 In `POST /api/public/book/:username/:slug`, mint the address **before** building the ICS and write it as part of `booking.create`, so a transaction that fails with `SLOT_TAKEN` leaves no booking behind a live address
- [ ] 4.5 Write `hostInvitationEmail` in the same create, from the source resolved for that invitation
- [ ] 4.6 Use the stored address as `From` and ORGANIZER, with the host's display name as `CN` and as the `From` display name
- [ ] 4.7 In `POST /api/public/booking/:token/cancel`, load the host's display name — the current `findUnique` has no `include`, so it is not available there — and use the booking's stored address, falling back to `SMTP_FROM` when there is none
- [ ] 4.8 Do the same in `POST /api/public/booking/:token/reschedule`, which already loads the user's display name
- [ ] 4.9 Never mint an address on the cancel or reschedule path; a booking without one keeps `SMTP_FROM` for its whole life
- [ ] 4.10 Leave `POST /api/admin/test-email` untouched — it has no booking and keeps the default sender

## 5. Inbound: receive, verify, parse

- [ ] 5.1 Add `routes/mail-inbound.ts` with a public POST route at `/api/webhooks/mail-inbound`, registered in `server.ts` — same shape as the existing `/api/webhooks/mollie` in `billing.ts`
- [ ] 5.2 Give the route its own content-type parser that retains the raw body buffer, since the default JSON parser discards the bytes the signature is computed over
- [ ] 5.3 Set an explicit body limit above Fastify's 1 MB default and add a per-route allowance to the global rate limit so provider retries are not answered with 429
- [ ] 5.4 Verify the provider signature over the raw body before anything else; reject otherwise
- [ ] 5.5 Drop deliveries whose message id has already been processed, answering success
- [ ] 5.6 Extract the recipient address, take the token from the local part, and load the booking by stored reply address
- [ ] 5.7 Discard silently — log line, success response — when the token is unknown, the booking is cancelled, or its end time is more than 30 days past
- [ ] 5.8 Read the `text/calendar` part only when it is inline; discard rather than follow a link
- [ ] 5.9 Take the DMARC-aligned authenticated sender from the provider payload; when there is none, treat the message as non-calendar mail

## 6. Inbound: record and forward

- [ ] 6.1 Parse `METHOD:REPLY`: responding `ATTENDEE`, `PARTSTAT`, `UID`, `SEQUENCE`, `DTSTAMP`
- [ ] 6.2 Discard when the UID does not match the booking's `icsUid`, or the method is not `REPLY`
- [ ] 6.3 Discard when the sequence is below the booking's current `icsSequence`
- [ ] 6.4 Require the responding attendee to equal the authenticated sender, and to be either `guestEmail` or `hostInvitationEmail`; log and drop a mismatch
- [ ] 6.5 Store status, answered sequence and receipt time against guest or host; reject a reply whose `DTSTAMP` is not newer than the stored one
- [ ] 6.6 Forward a message that carries no usable calendar reply to the booking's `hostInvitationEmail`, but only when the authenticated sender is that booking's guest or host
- [ ] 6.7 Log and drop anything else, always answering success so the provider does not retry

## 7. Surface the response

- [ ] 7.1 Include the response fields in the bookings API responses, reporting a status as outstanding when its stored sequence is behind the booking's current one
- [ ] 7.2 Show guest and host status in the booking list at `packages/web/src/app/bookings/page.tsx` — there is no detail view today and this change does not add one
- [ ] 7.3 Distinguish "no reply yet" from "declined" in the display
- [ ] 7.4 Flag a booking whose start time has passed without a host response as possibly never delivered
- [ ] 7.5 Show no status for bookings written directly to the calendar; the discriminator is `icsUid`, which is set only on the email path — not `replyAddress`, which is absent on pre-change email bookings too
- [ ] 7.6 Point the provider's webhook at `https://app.mein-kalender.link/api/webhooks/mail-inbound`

## 8. Verification

- [ ] 8.1 Token generation: entropy source, length, charset valid as a local part, uniqueness on collision
- [ ] 8.2 A booking with no stored address gets `SMTP_FROM` on cancel and reschedule, and no address is minted for it
- [ ] 8.3 A booking with a stored address keeps it after `INBOUND_MAIL_DOMAIN` is changed or removed
- [ ] 8.4 Invitation build: `From` equals ORGANIZER, both carry the host display name, fallback applies when unconfigured
- [ ] 8.5 A `SLOT_TAKEN` rollback leaves no booking reachable by the minted address
- [ ] 8.6 Webhook rejects an unsigned request, and a signature computed over a modified body
- [ ] 8.7 Webhook is idempotent across a repeated delivery
- [ ] 8.8 Records ACCEPTED, DECLINED and TENTATIVE for guest and, separately, for host
- [ ] 8.9 Attributes by recipient token while ignoring a conflicting attendee in the body
- [ ] 8.10 Drops a reply whose UID does not match the booking, and one whose sequence is stale
- [ ] 8.11 Drops a reply naming one attendee while authenticated as another — the guest cannot set the host's status
- [ ] 8.12 Drops a reply with no authenticated sender, and one from a non-participant
- [ ] 8.13 A replayed reply with an older timestamp does not overwrite a newer status
- [ ] 8.14 A reschedule makes an existing response report as outstanding
- [ ] 8.15 Unknown token, cancelled booking, booking ended over 30 days ago, link-only calendar part and unparseable body are all discarded with a success response
- [ ] 8.16 Prose mail from the guest is forwarded to `hostInvitationEmail`; mail from a third party is not forwarded anywhere
- [ ] 8.17 A decline leaves booking status, time and calendar event untouched

## 9. Rollout

- [ ] 9.1 Deploy with `INBOUND_MAIL_DOMAIN` unset and confirm invitations are unchanged
- [ ] 9.2 Enable the domain, make a real booking against a Proton host, and confirm the invitation is not filtered
- [ ] 9.3 Accept from the guest side and confirm the status is recorded
- [ ] 9.4 Accept from Proton and confirm the host status is recorded
- [ ] 9.5 Reply in prose from the guest side and confirm it reaches the host
- [ ] 9.6 Cancel a booking created before the change and confirm it still goes out as `SMTP_FROM`
