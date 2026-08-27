## Context

Booking invitations already work end to end for hosts on Proton: `routes/public-booking.ts` builds an ICS `METHOD:REQUEST` via `lib/ics-invitation.ts` and queues two mails — one to `source.emailForInvitations`, one to the guest. Reschedules and cancellations reuse the same UID with an incremented `icsSequence`, so updates match at the client. The `Booking` model already carries `icsUid` and `icsSequence`.

The gap is the return path. The three booking call sites (`public-booking.ts` invitation, cancellation and reschedule) set ORGANIZER to `process.env.SMTP_FROM || "noreply@mein-kalender.link"`. Per RFC 5546 a client sends its `METHOD:REPLY` to the ORGANIZER address, so every response goes to a mailbox nobody reads. No domain of ours has an MX record, so there is no inbound path at all.

`routes/admin.ts` also builds an invitation, but that is `POST /api/admin/test-email` — a self-addressed test message with a synthetic UID and no booking behind it. It is out of scope.

Outbound mail goes through one nodemailer transport in `lib/email.ts` with a single fixed `from`. Neither `mein-kalender.link` nor `mcal.ink` publishes SPF, DKIM or DMARC today.

## Goals / Non-Goals

**Goals:**
- Capture each attendee's participation status (accepted, declined, tentative) for a booking, tied to the event version it answers
- Keep the sender and ORGANIZER of a booking fixed for its whole life, including for bookings that predate this change
- Make possession of the reply address insufficient to falsify a status
- Keep a human reply from a participant from disappearing
- Keep all personal data with EU processors

**Non-Goals:**
- Writing arbitrary calendar events into Proton. Proton reads other calendars through the existing ICS feed export
- Handling `METHOD:COUNTER`. Counter-proposals are dropped like any other non-REPLY calendar method; negotiating a new time is separate work
- Replacing the outbound relay. Only the `From` address becomes per-message
- Changing anything about `POST /api/admin/test-email`

## Decisions

### One reply address per booking, not per user

The address is a random token stored on the booking. Alternatives considered:

- **Derived from the host address** (`christoph_heykurt.de@reply.mcal.ink`, the shape originally proposed). Rejected: it is computable by anyone, which turns the service into an open relay — a stranger could address `chef_competitor.de@reply.mcal.ink` and have us mail a third party under our own domain. The encoding is also ambiguous, since a local part may itself contain the separator.
- **One address per user.** Rejected: a permanent address is eventually scraped and becomes a spam target we have to filter, and attribution then depends on parsing the ICS UID out of every message.

Token format follows the precedent of `IcsFeed.token`: 32 characters from `crypto.randomBytes` over `[A-Za-z0-9]`, roughly 190 bits, valid as an RFC 5321 local part and well inside the 64-character limit.

### The full address is stored, not recomputed

`bookings.replyAddress` holds the complete address, not just the token. Deriving it from configuration at send time would mean that unsetting or changing `INBOUND_MAIL_DOMAIN` — which is exactly the rollback in the rollout plan — silently rewrites the ORGANIZER of bookings whose invitations are already in attendees' calendars. A stored address always wins over configuration; configuration is consulted only when minting a new one.

### Bookings that predate this change keep their old sender

Every existing booking has no reply address. The token is minted **only** when the initial REQUEST is sent, never on a reschedule or cancellation. A booking with no stored address keeps `SMTP_FROM` as `From` and ORGANIZER for its whole life.

Without this rule the first cancellation after deployment would arrive with a different ORGANIZER than the invitation that created the event. Clients key a stored event on UID together with ORGANIZER; a mismatch is commonly ignored or filed as a second event rather than an update. The guest would keep a cancelled booking in their calendar, and nothing would look wrong from our side, because delivery succeeds.

### `From` and ORGANIZER must be the same address

Clients treat an invitation whose sender disagrees with the ORGANIZER as forwarded or spoofed and may refuse to reply. Precisely: SPF authenticates the envelope sender (`MAIL FROM`), DKIM signs the header `From`, and clients compare ORGANIZER against the header `From`. Nodemailer's `from` sets the header and, by default, the envelope too, so both must be kept aligned — and both must be covered by the domain's SPF and DKIM.

Bounces are directed elsewhere via an explicit `Return-Path`, so delivery failures do not arrive at the reply address and get mistaken for participant mail.

`lib/email.ts` therefore takes an optional per-message `from`, defaulting to `SMTP_FROM`, leaving all existing mail unchanged.

### The host's name survives via `CN` and the `From` display name

`ORGANIZER;CN=Christoph Becker:mailto:t-<token>@reply.mcal.ink`, and the mail is sent as `Christoph Becker <t-<token>@reply.mcal.ink>`. A bare token address in the `From` line reads as spam and contradicts the point of keeping the host visible.

### A dedicated subdomain, not the app domain

`reply.mcal.ink` isolates machine mail from `mein-kalender.link`. A reputation problem on the inbound domain then cannot affect the domain that serves the app and the booking pages. `mkal.link`, named in the original idea, is not ours; `mcal.ink` is.

### Inbound via EmailConnect.eu

Only inbound is needed, which removes deliverability and reputation from the provider decision — those are outbound concerns. EmailConnect does inbound-to-webhook and nothing else, runs entirely in the EU (Hetzner Falkenstein, Scaleway object storage), and delivers small attachments inline; an iTIP reply is a few hundred bytes. Free below 100 messages per month.

Alternatives: Mailgun has an EU region but is operated by a US entity relying on the EU-US Data Privacy Framework, which does not improve on the status quo where that matters. Brevo (France) hands over attachments only as download tokens, adding a fetch per reply. Self-hosting an inbound MTA is viable — receiving carries no reputation risk and the cluster exists — but costs an open port 25 and our own spam filtering for a handful of messages a day.

The coupling is one webhook endpoint, so switching providers costs an MX record and no code.

### Only inline calendar parts are read

The payload is attacker-influenced, so following a `downloadUrl` out of it would be a request-forgery path for the sake of a payload that is a few hundred bytes. Calendar parts above the inline threshold are dropped rather than fetched.

### Identity: three independent checks, all required

The webhook is public, so it first verifies the provider's signature over the **raw** request body. Fastify's JSON parser discards the raw bytes, so the route needs its own content-type parser that keeps the buffer, plus an explicit body limit above the global 1 MB default.

After that, a status is recorded only if all of the following hold:

1. The **recipient token** selects the booking. Nothing in the message body may select a different one.
2. The message's **UID matches that booking's `icsUid`**. A reply about another event is dropped rather than applied to whichever booking the token happens to name.
3. The replying `ATTENDEE` matches the **DMARC-aligned sender** reported by the provider, and is either the booking's guest or its stored host address.

Check 3 is what makes the token insufficient on its own. Without it, the guest and the host share one reply address, so either could set the other's status, as could anyone holding a forwarded copy of the invitation.

### Replies are ordered by our clock, not theirs

`DTSTAMP` and the `Date:` header both come from the message, so ordering by them lets a replayed old acceptance override a later decline. Precedence is decided by webhook receipt time; additionally, a reply whose `DTSTAMP` is not newer than the stored one is rejected. Deliveries are idempotent, because providers retry.

### A reply answers one version of the event

The reply's `SEQUENCE` is stored alongside the status. A reply with a sequence below the booking's current `icsSequence` is ignored, and a stored status whose sequence is behind the booking's is reported as outstanding rather than as an answer. Otherwise a guest who accepted the original time would still read as "accepted" after the booking was moved — the opposite of what the host needs to know.

### Non-calendar mail from a participant is forwarded

`From: Christoph Becker <t-…@reply.mcal.ink>` looks like a person's address, so guests will reply in prose. Such a message is forwarded to the host's stored invitation address instead of being discarded.

Forwarding is bounded by the same alignment check as a status: only mail whose authenticated sender is the booking's guest or host is forwarded, and only ever to the host address stored on that booking. The destination is never taken from the message, so this is not a relay — spam to the token address fails the check and is dropped.

## Risks / Trade-offs

- **SPF, DKIM or DMARC misconfigured → invitations reach spam and the feature appears simply broken.** Mitigation: the first task is a delivery test to a Proton address, run before any ORGANIZER changes. Since no mail authentication exists today, that test doubles as a baseline for the invitations already being sent.
- **DMARC alignment is unavailable or unreliable from the provider.** Mitigation: without a trustworthy authenticated sender, no status is recorded and the message is treated as non-calendar mail. Failure mode is the current behaviour, not a wrong status.
- **Provider outage swallows replies.** Mitigation: replies are additive information, never a precondition for a booking. A missed reply leaves the status outstanding, which is today's behaviour.
- **Forwarding relays unwanted mail to the host.** Mitigation: the alignment check limits it to the two participants of that one booking, and the destination is fixed.
- **Reply parsing meets ill-formed ICS.** Mitigation: unparseable mail is logged and dropped with a success response, so the provider does not retry indefinitely.
- **Reply addresses accumulate.** Mitigation: replies are refused for cancelled bookings and for bookings that ended more than 30 days ago.
- **A per-message `From` touches every mail the app sends.** Mitigation: the parameter is optional and defaults to the current value, so only the booking invitation call sites change behaviour.
- **The invitation is queued before the booking row commits** (`public-booking.ts` queues at 218/226, the transaction can still throw `SLOT_TAKEN`). This change makes the pre-existing defect visible, since an invitation could carry an address for a booking that never existed. Mitigation: the token is generated before the ICS is built and written as part of `booking.create`, and a reply for an address with no booking hits the unknown-token path and is dropped.

## Open Questions

- Whether the host's response should be shown as prominently as the guest's, or only surfaced when it is missing — a missing host response is the signal that the invitation never reached the Proton calendar.
