# LANDrop design

Authority: [unaltered supplied guide](../../source-guide.md). Implement the supplied ten-task plan. No database, no cloud, no WebRTC, no refresh-resume. Host is trusted; HTTP is unencrypted.

## Direction
True-black-flat, seed 4173; Inter locally served with OFL license. Ground #000, surface #111, raised #2a2a2a, white inverted controls; lime only for acknowledged progress/status. Signature: sender → host → receiver, with distinct acknowledgement, verification, readiness and download-request labels. No invented download completion.

Objects: sessions (8 hours), rooms (8 identities, owner, invitation, lock, revision), metadata-only offers (20 files / 2 GiB or 64 KiB UTF-8 text), files (1 MiB sequential chunks), reservations, actual emitted-byte metrics. Room question: what needs approval or is moving? Detail: where are my bytes? Insights: what did this application actually transfer? Settings: who can join and when does this room disappear?

Ruling: redraw home pattern to a consent-first workspace, not greeting/count tiles: new sessions have no truthful count-tile data. Keep ruled T-frame in rooms; use compact first-run forms outside rooms. At mobile widths use a single main destination and push details, not simultaneous panes. 44px touch targets supersede dealt 36px controls on phones. Adapt neutral app.css foundation, no motion floor.

## State tables
Transfer: offered → accepted → transferring → completed. Offered may reject/cancel/expire; accepted/transferring may cancel/fail/expire. Completed content is revoked on deletion/expiry rather than pretending transfer delivery was undone. File: queued → uploading → verifying → ready; any resource can revoke; non-ready files may fail. Zero bytes still require verification.

## Security / concurrency
Opaque cookie identities, CSRF header, strict Host and Origin. Only pair participants see private transfers; room owners only manage membership. Per-file lock for write/finalize; synchronous reservation admission; revoke before awaiting I/O or disk cleanup. No payload before acceptance. Ready content survives non-owner sender disconnect, but not room death. Startup only deletes recognized UUID payloads in an owned directory, never arbitrary content.

## Budgets / assumptions
8 GiB disk reservations, 4 MiB accepted text, 64 rooms, 1,024 sessions, 32 pending per room / 8 per sender, 8 chunk requests, 2 verifications, 4,096 transfer records. Stall after 10 min; offer 2 min; ready 30 min; room idle 60 min; disconnect grace 60 s. One room per session. Removed and departed members cannot rejoin the same room. Failed deletion retains reservation and retries. No secure erase claim.
