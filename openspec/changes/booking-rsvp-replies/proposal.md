## Why

Booking invitations name `noreply@mein-kalender.link` as ORGANIZER. Calendar clients send every acceptance, decline and cancellation to the ORGANIZER address, so all of it is discarded. The host learns a guest's answer only by looking at their own calendar, and the app never learns it at all — bookings show as confirmed whether the guest accepted, declined or ignored the invitation.

This matters most for hosts whose calendar lives in Proton. Proton has no write API, so the emailed invitation is the only channel into their calendar; if that channel is one-way, a booking page is not usable for them in practice. The host's own response is also the only evidence that the invitation reached the Proton calendar at all.

## What Changes

- Each booking gets its own reply address, an unguessable random token on a dedicated inbound domain (`t-<token>@reply.mcal.ink`), stored in full on the booking
- That address becomes both the `From` header and the ICS `ORGANIZER` of the invitation, replacing `noreply@mein-kalender.link`. The host's name stays visible via `ORGANIZER;CN=` and the `From` display name
- Bookings created before this ships keep their original sender for their whole life, so reschedules and cancellations still match the invitation already sitting in attendees' calendars
- Inbound mail for the domain is received by an external service and delivered to a new webhook endpoint
- The webhook parses iTIP `METHOD:REPLY` messages and records each attendee's participation status, bound to the event version it answers
- Mail from an attendee that is not a calendar reply — a prose answer, an out-of-office notice — is forwarded to the host instead of being dropped
- Bookings expose the guest's and the host's response status

Not in scope: writing arbitrary calendar events into Proton. Proton already reads other calendars through the existing ICS feed export; this change only closes the loop on booking invitations. Counter-proposals (`METHOD:COUNTER`) are also out of scope.

## Capabilities

### New Capabilities
- `booking-rsvp-replies`: Per-booking reply addresses used as invitation ORGANIZER, inbound handling of iTIP REPLY messages, forwarding of non-calendar mail, and the resulting participation status on a booking

### Modified Capabilities
- `booking-management`: Gains a requirement that a booking shows its attendees' response status. Purely additive — no existing requirement changes behaviour

## Impact

- **Backend**: new webhook route for inbound mail; ORGANIZER call sites in `routes/public-booking.ts` (invitation, reschedule, cancellation) change; `lib/email.ts` gains a per-message `From`. `routes/admin.ts` is unaffected — its invitation belongs to a test endpoint with no booking behind it and keeps the default sender
- **Database**: `bookings` gains the reply address, the host's invitation address, and per-attendee response status with the sequence it answers
- **Frontend**: the booking list at `packages/web/src/app/bookings/page.tsx` shows the responses. No detail view exists today and none is added
- **Infrastructure**: MX for `reply.mcal.ink` pointing at the inbound provider; SPF, DKIM and DMARC for that domain so the existing SMTP relay may send as it and so replies can be checked for sender alignment. None of our domains has any mail authentication today, so this is new ground rather than an adjustment
- **Dependencies**: an inbound-mail provider (EmailConnect.eu — EU-hosted, webhook-based, free below 100 messages/month). Outbound continues to use the existing SMTP relay
- **Security**: the reply address is a random token, never a derived or guessable form of the host's address. A recorded response additionally requires the replying attendee to match the authenticated sender, so possession of the address alone does not let anyone falsify a status
