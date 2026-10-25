# Verification record

Observed locally on **2026-10-25**, Windows `10.0.26200` (`win32`), Node `v24.22.1`, npm `11.19.1`. Results below are observations, not claims about untested physical devices or every operating system. GitHub Actions is configured for Windows and Ubuntu/Node 24; **hosted CI has not been run in this checkout**. No independent worker/reviewer tool was available; implementation and code/visual review were performed inline.

## Fresh automated gates

| Command | Observed result |
| --- | --- |
| `npm ci` | Passed from pinned lockfile |
| `npm run typecheck` | Passed: shared protocol, server, web, integration/E2E TypeScript |
| `npm run lint` | Passed: ESLint, no errors |
| `npm test` | **35 passed, 16 files** |
| `npm run test:integration` | **14 passed, 8 files** |
| `npm run build` | Passed; server bundles shared protocol, Vite emits separate hashing worker and local assets |
| `npm run test:e2e` | **13 passed**, about 2.1 minutes, production server on 4173 |
| `npm audit` | **0 known vulnerabilities** at observation time |

The final browser run used the freshly rebuilt code, including upload-abort admission, file-slot handoff and cleanup-pending UI fixes. Eleven Chromium cases plus Firefox and WebKit sharing smoke tests passed. Smoke includes verified native file download, exact downloaded contents, literal script-like UTF-8 text, copying and deletion through the real API. The production rate limiter remains enabled; tests wait/retry when independent loopback identities exceed its per-minute bootstrap cap. This explains the minute-long case, rather than disabling security for tests.

Vite reports nonfatal upstream Zod `@__PURE__` comment-position warnings and removes those annotations. Build exits successfully; these are not suppressed correctness failures. Dependencies were upgraded to patched pinned releases rather than retaining vulnerable initial candidates.

## Coverage and review matrix

| Concern | Evidence |
| --- | --- |
| Numeric/UTF-8/file-count/total-size/filename/state boundaries | `packages/protocol/src/protocol.test.ts` |
| Origin/Host/CSRF/bootstrap/cookies/expiry/rate caps/config validation | `apps/server/src/security/*.test.ts`, `tests/integration/boundaries.test.ts` |
| Eight identities, lock/rotation, removed sessions and owner boundaries | `apps/server/src/rooms/rooms.test.ts` |
| Shared-cookie tabs, aggregate presence, WS membership and grace | `apps/server/src/realtime/realtime.test.ts`, `tests/e2e/invitations.spec.ts` |
| Metadata-only consent, no upload after rejection, recipient-only decisions | `apps/server/src/transfers/offers.test.ts`, `tests/e2e/security.spec.ts` |
| Competing full-offer reservations | `tests/integration/resource-races.test.ts` |
| Sequential/exact/partial chunks, hashes, replay conflict and concurrent duplicates | `apps/server/src/transfers/chunk-upload.test.ts` |
| Lost acknowledgement and refresh limitation | `apps/web/src/transfer/controller.test.ts`, `tests/e2e/recovery.spec.ts` |
| At most two browser files, including arrival during a queued-slot handoff | `apps/web/src/transfer/slots.test.ts` |
| Partial-body aborts cannot leak all eight host upload slots | `tests/integration/aborted-upload.test.ts` using real TCP connections |
| Partial disk-write rollback / storage failure revoke | `tests/integration/storage-failure.test.ts`, `resource-races.test.ts` |
| Empty/incomplete/full-digest mismatch/duplicate finalize | `apps/server/src/transfers/finalize.test.ts`, `tests/e2e/integrity.spec.ts` |
| Receiver-only ranges, safe attachments, streamed download revoke | `apps/server/src/downloads/downloads.test.ts`, `tests/integration/revocation.test.ts` |
| Owner/nonparticipant cannot enumerate another pair | `tests/integration/resource-races.test.ts`, three-context `tests/e2e/security.spec.ts` |
| Text consent/UTF-8/literal content/idempotence/retry accounting | `apps/server/src/text/text.test.ts`, `apps/server/src/metrics/text-replay.test.ts` |
| Request-time expiry, idle/absolute lifetimes, disconnect grace and retention | `apps/server/src/lifecycle/lifecycle.test.ts`, `rooms.test.ts`, `resource-races.test.ts` |
| Failed unlink retains capacity and retries; recognized-only orphans/shutdown | `lifecycle.test.ts`, `tests/integration/shutdown.test.ts` |
| Duplicate host startup cannot sweep a running host's storage | `tests/integration/storage-lock.test.ts` |
| Scoped metrics/export and undefined goodput | `apps/server/src/metrics/metrics.test.ts`, `tests/e2e/insights.spec.ts` |
| 1440/768/390, keyboard/Escape/focus/local fonts/manual clipboard fallback | `tests/e2e/responsive.spec.ts` |
| Genuine insecure-context HTTP worker hashing, no external runtime asset requests | `tests/e2e/http-lan.spec.ts`: local browser used a discovered nonloopback host IPv4, `isSecureContext === false` |

The insecure-HTTP test is still **one machine**. It is not a phone, cross-device Wi-Fi or internet-disconnection test. Framework injection covers many API boundaries; real native HTTP/TCP and browser tests supplement it. Failures are injected only by tests/design scripts, never by the production application.

### Red/green issues caught and fixed

- A valid 64 KiB text expanded sixfold under JSON escaping and exceeded the old JSON body cap; the cap now covers worst-case valid encoding.
- Malformed non-ASCII CSRF header bytes reached timing-safe equality with inconsistent buffer lengths; shape is now validated first.
- Disk-write failures failed to revoke immediately; revocation/cleanup now follows the storage error, with reservation held through deletion.
- An early-ready file could outlive its 30-minute cap while a sibling remained unfinished; the earliest ready deadline now conservatively bounds the offer.
- Text retries were omitted from ingress; retries increase ingress but never unique acknowledged bytes.
- The old two-file slot pool exposed a handoff gap: an arriving task overtook a queued waiter and produced **three** concurrent readers. A deterministic microtask regression failed at 3, then passed at 2 after direct slot handoff.
- Eight aborted partial-body requests permanently consumed all host chunk slots (a subsequent valid request got **503**). Real TCP regression now observes 200 after all eight aborts; handler-stage work retains its slot until completion.
- Duplicate startup could treat another live host's payload as an orphan; a process lease now rejects the second live host before sweeping.
- UI deletion did not report the returned cleanup state; browser regression now confirms access revocation and an explicit pending/finished host-cleanup message, without equating revocation with completed deletion.

## Streaming observations — not a constant-memory proof

`tests/integration/streaming.test.ts` generates a disk-backed **32 MiB** file by default, uploads bounded chunks, verifies it and downloads via native streamed HTTP. The latest observed run recorded:

| Measurement | Bytes |
| --- | ---: |
| Generated file | 33,554,432 |
| Baseline RSS | 110,669,824 |
| Observed peak RSS | 175,853,568 |
| Observed delta | 65,183,744 |

Server and test client share a Vitest process; buffered injected chunk requests, test concurrency, runtime allocation and GC affect RSS. The result demonstrates that this generated-file streaming scenario completed with correct bytes, **not** constant memory, host-only memory, browser-only memory, a load benchmark or successful 2 GiB transfer. The test writes raw current observations to ignored `.superpowers/streaming-observations.json`.

The opt-in `LANDROP_LARGE_FILE=1` generates/transfers 2 GiB and is **not run / pending**. Protocol validation tests do exercise the exact 2 GiB metadata boundary; that is a different claim.

## Visual inspection

Direction: **true-black-flat**, seed **4173**, self-hosted Inter; neutral black/surfaces, inverted controls, lime for real status/progress. The consent-first welcome replaces the dealt greeting/KPI home because a new identity has no truthful KPI history. The branded relay path separates host acknowledgement/verification from receiver download requests. There is no chart of invented history and no production sample dataset.

- Source tasteskill lint: **0 FAIL, 1 WARN**. “Unlock room” is retained because it literally reverses the room lock, not a marketing slogan.
- Production home inspection: **0 FAIL, 1 WARN**. Retained capped welcome width avoids stretching two short forms into a dashboard; the authenticated workspace uses available width.
- Authenticated approval, populated room, ready detail, insights and owner controls: **0 FAIL** at **1440, 768 and 390 px**, using the unmodified skill probes/rules in `scripts/inspect-authenticated.mjs`. All 15 final screenshots were opened and reviewed.
- Retained authenticated WARNs: dealt **20px application titles** are intentional utility hierarchy, not a marketing hero; mobile detail uses **12px compact relay/status labels**, with primary filenames/content/actions at 14px or more. The final screenshot has no split “acknowledged” word or collisions. A percentage-of-small-text heuristic flags the compact labels; no text is below 12px.
- Separate real-app state inspection (`scripts/inspect-states.mjs`) captured **loading, host-fetch error, checksum-paused, cleanup-pending and disconnected/stale** at all three widths; all 15 screenshots were opened. Browser-local faults are explicit. Empty approval/transfer frames and literal zero counts remain honest. The script revokes its test room afterward.

Artifacts are local/ignored: `.taste-skill/inspect/`, `.taste-skill/authenticated/`, `.taste-skill/states/`, `.taste-skill/browser/`. The direction sheet is tracked. Optional design scripts need the supplied local `.agents/skills/design-taste-frontend` checkout; production and CI do not depend on those tools.

### Seven-question app critique

1. **Question first:** Room prioritizes actionable approvals and transfers, detail answers “where are my bytes?”, insights answers “what did this app transfer?”, controls answers “who can join?”. Primary send/accept/download/invite jobs are immediate.
2. **Edges/density:** Main panels share edges; reference copy is marginal, not competing peer cards. No stretched cards with fake empty charts. The sparse first-run page is deliberately capped, not padded with metrics.
3. **Meaningful color/face:** Inter really loads (browser assertion); LANDrop mark and sender → host → receiver provide product identity. Lime means verified/online/progress; red is destructive/error, not navigation decoration.
4. **Consistent facts:** Counts/totals/progress derive from server DTOs; the inspected 60 B example showed 60 B acknowledged, 60 B ingress and zero download-stream bytes before a download. Units are explicit and values tabular. No rate is labeled bandwidth.
5. **Zero/missing:** Queues show “0 waiting”, zero bytes remain 0 B; undefined goodput is a dash. Empty sections retain their purpose. No invented growth/deltas.
6. **Marks/labels:** The relay labels explain actual stages; there are no chart legends to misrepresent. The mobile acknowledgement wrap was corrected without hiding fields.
7. **Phone:** Sidebar becomes compact navigation, reference rail folds away, approvals/actions stay primary, metrics stack into labeled rows rather than forcing horizontal scrolling. Dialogs scroll within the viewport with keyboard Escape/focus restoration and 44px mobile buttons.

The three largest visual corrections were stacked mobile metric rows preserving every field, demoting the reference column to marginal copy, and fixing mobile relay label readability/wrapping. No decorative motion was added.

## Manual acceptance — still pending

Do not mark these passed without real observation on the demonstration network:

- [ ] Phone and another computer reach the host LAN URL on actual Wi-Fi; record devices/browser/OS and addresses used.
- [ ] QR join and manual room code; guest-network/client-isolation/firewall behavior observed.
- [ ] Real file/text offer → reject (no payload) → accept → verified download/copy.
- [ ] Non-owner sender disconnect after verification; receiver still downloads within retention.
- [ ] Room closure/delete revokes remote access on those physical devices.
- [ ] Repeat after internet is disconnected while LAN remains available; no external dependency.
- [ ] Optional HTTPS certificate trusted on every physical client and WS connection successful.
- [ ] Opt-in 2 GiB test, if desired; record disk/time/RSS and actual result separately.

Use [networking](networking.md) for deployment troubleshooting and [demo](demo.md) for the five-minute viva. A download request is not proof of saving; application goodput is not link bandwidth; access revocation is not secure media erasure.
