# LANDrop implementation plan

Source: user-supplied approved plan, 2026-10-25, planning session `01a17347-1ff7-76a8-bd0a-4c8599cbfcf3`. The user request remains the complete implementation contract.

1. Establish npm TypeScript workspaces, protocol DTO/schema/limits/state tests and documents.
2. Secure Fastify foundation, injectable clock/storage/scheduler, sessions, Host/Origin, CSRF, bounds, optional TLS and static build.
3. Rooms, rotating invitations, owner controls, pair-scoped snapshots, authenticated WebSocket invalidations and session-aggregated presence.
4. Metadata-only consent and atomic file/text budget admission; participant-only decisions and idempotence.
5. Dedicated disk storage, sequential hashed chunks, replay validation, file locks and authoritative status reconciliation.
6. Streaming full-file verification, receiver-only native downloads, strict ranges and revocation during I/O.
7. Accepted literal text, lifecycle scheduler, immediate expiry, disconnect grace, orphan recognition, cleanup retries and shutdown.
8. Participant metrics, sanitized aggregates and scoped JSON export; actual emitted bytes and application goodput.
9. True-black-flat React workspace, local fonts/QR, worker hashing, bounded uploads/retries, refresh limitations, keyboard/mobile/HTTP fallback flows.
10. Production Playwright, Vitest integration/race tests, CI, networking/security/protocol/demo documentation and evidence.

Verification: `npm ci`, typecheck, lint, unit, integration, production build, production Playwright on 4173. Run tasteskill lint/inspection at 1440/768/390 and read screenshots. Physical LAN/phone/offline checks remain pending until actually observed. Never equate acknowledgement with receiver save, goodput with bandwidth, or revocation with completed deletion.
