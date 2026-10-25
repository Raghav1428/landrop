# Protocol and lifecycle

The shared source of truth is `packages/protocol/src/`. Sizes are integer UTF-8/content bytes, not characters. Commands and payloads use HTTP. Authenticated WebSockets carry only `{roomId, revision}` invalidations; clients fetch a fresh participant-scoped snapshot. Reconnects always resynchronize; polling/heartbeats do not count as room activity.

## Identity and authorization

`POST /api/session` bootstraps a JSON identity with a same-origin check. It returns a public session ID, display identity, absolute expiry and CSRF token. An independent random 256-bit token lives in an HttpOnly SameSite=Strict cookie, Secure when using HTTPS. Subsequent mutations need `X-CSRF-Token`. `GET /api/session` restores the identity and current room, never selected file references.

Sessions expire absolutely after eight hours. A browser profile has one identity and one active room; its tabs share the cookie. Up to four WebSocket tabs per identity are admitted. Closing the last connection starts a 60-second grace for unfinished transfers. Already ready content is not revoked merely because the non-owner sender disconnects.

A room owner manages the room but has no private-transfer privilege over a different pair. Nonparticipants get indistinguishable transfer-not-found errors. Only the sender uploads/finalizes/submits text; only the intended receiver accepts/rejects/downloads. Both pair participants may cancel/delete. Every transfer operation also requires live room membership and a live caller session.

## API reference

All JSON error responses are `{error:{code,message,retryable}}`. Except the session bootstrap, all mutation endpoints require a valid cookie and CSRF header. Resource IDs are opaque, not an authorization mechanism.

| Method / path | Body / result |
| --- | --- |
| `GET /api/health` | `{ok:true}` |
| `GET /api/config` | Public limits, deployment address candidates and transport flag; no storage path/budget secrets |
| `GET`, `POST /api/session` | Session DTO / `{name,device}` (`computer`, `phone`, `tablet`, `other`) |
| `POST /api/rooms` | `{}` → new owner snapshot |
| `POST /api/rooms/join` | `{code}` or `{roomId,secret}` → member snapshot |
| `GET /api/rooms/:roomId` | Scoped snapshot, members, sanitized aggregates; invitation only for owner |
| `POST /api/rooms/:roomId/lock` | Owner `{locked:boolean}` |
| `POST /api/rooms/:roomId/rotate` | Owner `{}` → new code and secret; existing members remain |
| `POST /api/rooms/:roomId/remove` | Owner `{memberId}`; permanently prevents this session rejoining |
| `POST /api/rooms/:roomId/close` | Owner `{}` → revoke room and content |
| `POST /api/rooms/:roomId/leave` | `{}`; owner leave closes room, others revoke their transfers |
| `GET /api/rooms/:roomId/events` | Cookie + exact Origin + membership-authenticated WebSocket upgrade |
| `POST /api/rooms/:roomId/offers` | File/text metadata only, below |
| `GET /api/transfers/:id` | Pair-private transfer DTO; text content only to receiver after delivery |
| `POST /api/transfers/:id/accept`, `/reject`, `/cancel` | `{}`; accept/reject receiver-only, cancel pair-only |
| `DELETE /api/transfers/:id` | Immediate revoke; cleanup may remain pending |
| `PUT /api/transfers/:id/files/:fileId/chunks/:index` | Octet-stream ≤1 MiB, `X-Chunk-SHA256` lowercase hex digest |
| `GET /api/transfers/:id/files/:fileId/status` | `{nextChunkIndex,committedBytes,state}` |
| `POST /api/transfers/:id/files/:fileId/finalize` | `{sha256}` full-file digest; streams host verification |
| `GET /api/transfers/:id/files/:fileId/download` | Receiver-only ready attachment; optional single Range |
| `POST /api/transfers/:id/text` | Sender `{text}` only after acceptance |
| `GET /api/transfers/:id/text` | Receiver-only literal UTF-8 text attachment |
| `GET /api/rooms/:id/insights`, `/insights/export` | Scoped JSON; export adds attachment header |

Example file offer:

```json
{"kind":"files","recipientId":"opaque-recipient-id","files":[{"id":"file-0","name":"notes.txt","size":12}]}
```

A text offer is `{"kind":"text","recipientId":"…","byteLength":12}`, never the text. Unknown offer fields, including `content` and `text`, are rejected. A recipient must be a distinct online room member. Per-file IDs are unique and stable in the offer. Filenames are display metadata only: separators, control characters, empty/dot names and over-255-character names are rejected. Internal disk names are random UUIDs.

## State transitions

| Transfer state | Allowed successors |
| --- | --- |
| offered | accepted, rejected, cancelled, expired |
| accepted | transferring, cancelled, failed, expired |
| transferring | completed, cancelled, failed, expired |
| completed / rejected / cancelled / failed / expired | No delivery-state successor; content can be revoked/deleted |

Files: `queued → uploading → verifying → ready`; non-ready files may fail, any file may be revoked. A zero-byte file still goes through full SHA-256 verification. Deletion marks resources revoked before awaiting any I/O, then drains writes/verifications/downloads, removes payload files, and releases reserved capacity only after successful deletion. Failed deletion retries with capped exponential backoff. A completed transfer is not renamed "delivered to receiver" or "saved".

## Chunk commitment and recovery

The whole file offer is reserved atomically at acceptance, not one file/chunk at a time. Requests serialize per internal file ID. The server validates expected index, exact expected chunk length and SHA-256 before writing; one bounded chunk is buffered. Committed checkpoints advance only after write and sync succeed. A partial write is truncated back to the previous committed offset before recovery; unrecoverable storage errors revoke the transfer and schedule cleanup.

Identical committed replays acknowledge existing progress without appending or counting unique bytes twice. Conflicting replays fail. Replays do not extend the stall timeout. The sender queries status after an uncertain response, instead of blindly appending again. Browser retries are bounded and stop on terminal authorization/state/integrity errors. Full-file verification is streamed with two global slots. The browser hashes incrementally in a worker using `@noble/hashes`, with at most two active files per page; no 2 GiB browser buffer or secure-context-only crypto dependency.

Refreshing loses `File` references; the restored UI explicitly marks unfinished sends as unresumable from that page. Original still-open tabs may continue.

## Limits and expiry

| Limit | Value |
| --- | --- |
| Room identities, including owner | 8 |
| File count | 1–20 |
| Per file / total offer | 2,147,483,648 B = 2 GiB |
| Chunk | 1,048,576 B = 1 MiB |
| Text | 65,536 UTF-8 B = 64 KiB (empty text allowed) |
| Unanswered offer | 120 s |
| Ready file / delivered text | Up to 30 min, never beyond room survival |
| Room absolute lifetime | 8 h, bounded by owner session expiry |
| Idle room | 60 min without meaningful activity or progressing unfinished transfers |
| Last-connection grace for unfinished work | 60 s |
| Stalled unfinished transfer | 10 min without unique progress |

For a multi-file offer, the **earliest ready file** conservatively bounds the entire offer's retention, even if siblings are still uploading. Reads enforce expiry immediately; cleanup timer delay never grants extra access. Resource defaults: 8 GiB disk, 4 MiB text reservations; 64 rooms, 1,024 sessions; 32 pending per room / 8 per sender; 4,096 transfer records; 8 active chunk requests; 256 transport connections. Pending, rejected and expired offers reserve no payload budget. Rate limits include 20 bootstrap attempts per IP/minute, 12 joins per identity/minute and 1,800 API requests per IP/minute. These are application safeguards, not a public-internet DoS defense.

## Downloads and metrics

Single `bytes=start-end`, `bytes=start-`, and `bytes=-suffix` ranges return 206 and a correct Content-Range. Malformed, unsatisfiable, unsafe-integer or multi-range requests return 416 and `bytes */size`. Empty files return 200/length 0; every range on them is unsatisfiable. Attachments use sanitized ASCII fallback plus RFC 5987 UTF-8 filename, nosniff and no-store. Revocation destroys active streams.

Metrics are application-level: logical offered bytes; unique acknowledged bytes; received payload ingress including retries; bytes emitted by the download stream (not proof of remote receipt/save); host verification milliseconds; monotonic elapsed upload milliseconds. Goodput is unique acknowledged bytes / elapsed upload seconds; undefined duration is `null`/a dash, never Infinity. Logical file sizes can exceed ingress while an offer is waiting. Room totals reveal only member/transfer counts and acknowledged-byte sums; detailed metrics and identifiers remain pair-private. Export version 1 documents units and scope.

## Error codes

`VALIDATION` (400/413/415), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `EXPIRED` (410), `CONFLICT` (409), `CAPACITY` (409/429/503/507), `RATE_LIMIT` (429), `INTEGRITY` (422), `RANGE` (416), `STORAGE` (500), `UNAVAILABLE` (503). A retryable error is not permission to replay payload blindly: reconcile first. Room closure may make a formerly live transfer return 404 rather than 410; both mean stop.
