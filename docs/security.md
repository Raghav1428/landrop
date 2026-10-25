# Security and trust model

**For a trusted private LAN, not an internet-facing file hosting service. Default HTTP is unencrypted. The host operator can read content.** No accounts, end-to-end encryption, malware scanning, verified hardware identity or secure erasure are claimed.

## Boundaries

- The **host operator** controls Node, memory and temporary disk; therefore they are trusted with all content. A **room owner** has only room-management API rights, not permission to inspect another pair's offers, filenames, text, file status/downloads or detailed metrics.
- A browser-session identity is an opaque random cookie secret, distinct from the public random member ID. HttpOnly, SameSite=Strict, path `/`, eight-hour absolute expiry; Secure when configured with TLS. Multiple tabs aggregate presence by the shared session.
- Bootstrap is JSON-only with strict deployment Origin/Host validation. State changes after bootstrap require a separate random CSRF header, including raw chunk uploads. Invalid CSRF encodings fail authorization, not an internal timing comparison error.
- Host is validated against localhost/discovered IPv4 addresses and explicit exact origin overrides. Browser Origin must be an allowed origin with the same Host. WebSocket upgrades require cookie, exact Origin, membership and live room/session. No reflected invite URL, wildcard CORS, proxy trust or invitation secrets in logs.
- The room QR secret is 256 random bits; its 10-character unambiguous base32 code is separately random. Rotation atomically replaces both. Failed/repeated joins are rate-limited. Leaving/removal prevents the same session from rejoining that room.
- Transfer endpoints independently authorize the pair. Being in the room, guessing a file ID or being its owner is insufficient. Text appears only in the receiver's DTO after acceptance/delivery and is rendered literally, never via innerHTML.

## Admission, storage and temporary access

Offers strictly accept metadata, not content. Acceptance atomically reserves the full offer budget. Unaccepted/rejected/expired metadata consumes no payload capacity. Per-file operations serialize chunk writes, replay decisions and finalization; deletion revokes synchronously before waiting for the lock. Digest/length/order checks precede commitment. Full verification gates readiness. Download stream revocation is tested during an active response.

Payloads are stored under generated UUID `.part` names inside a dedicated application-owned directory; user filenames never form paths. First startup refuses a nonempty unmarked directory. Startup removes only recognized regular payload files, not arbitrary files/subdirectories or symlinks. A process lease prevents an ordinary duplicate host startup from sweeping active content; clean close releases it and a dead PID lease can be reclaimed on restart. Use **one process per local storage root**, never shared/network/synchronized multi-host storage. This is not a distributed filesystem lock. A malformed marker or a lease PID reused by another live process is conservatively refused: verify no LANDrop process uses that root before operator recovery; never delete a live lease just to bypass the error.

Expiry is checked on requests and in a one-second sweep. Polling/heartbeats do not extend room lifetime. Disconnect grace affects unfinished transfers, not already ready payloads just because the sender's connection disappeared. Membership removal/room closure do revoke them. Revocation aborts streams and waits for active locks/handles; disk reservations remain charged through failed deletions, with bounded retry backoff. Temporary deletion is ordinary unlink, not secure media erasure. Restart loses all sessions/rooms/text and cleans recognized disk orphans; nothing is restored for download.

HTTP downloads are receiver-only attachment streams with safe encoded filenames, nosniff and no-store, never static URLs or inline HTML. Single ranges are supported; malformed/multiple/unsafe ranges fail. JSON/text/chunk sizes, connection counts, session/maps, offers, upload requests, verification concurrency and storage budgets are bounded. API logs are disabled by default; exceptions return sanitized errors rather than content, paths or stack traces. Static assets carry a same-origin CSP, no-referrer and frame-ancestor restrictions.

## Known limitations / operational responsibilities

- Anyone who can observe unencrypted HTTP can read content and potentially steal credentials/invitations. SameSite and CSRF are not transport encryption.
- Anyone with an invitation can attempt to join until locked/rotated/full. Display names and device types are self-asserted. Use invitations deliberately.
- Limits are safeguards, not a hardened public-internet DoS defense. Do not port-forward this server publicly. The host disk may have less free physical capacity than the configured reservation budget; actual write failures still revoke and clean up.
- The owner can remove/close a room and thereby deny sharing, but cannot bypass pair privacy through the API. The host operator can always inspect the filesystem/memory.
- A matching SHA-256 digest only compares the sender's claimed bytes to the host's bytes. It says nothing about malware or authenticity.
- Browser refresh loses original File objects. Native download requests and emitted bytes cannot prove the destination saved a file.
- Manual phone/LAN/offline checks and optional trusted certificate validation must be performed on the actual demonstration network; local automated tests are not substitutes.

Report reproducible issues with steps and sanitized API error codes. Do not include real shared content, cookies, CSRF values, invitation secrets or TLS keys in issue reports.
