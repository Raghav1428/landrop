# LANDrop

Temporary file and plain-text sharing between browsers on a reachable local network. **Sender → host → receiver**, with receiver approval before any payload upload. Not WebRTC or direct peer-to-peer sharing.

## Run the host

Use **Node.js 24 LTS** (or 22.18+) and npm. From this directory, on Windows, macOS or Linux:

```sh
npm ci
npm run build
npm start
```

The default listener is `0.0.0.0:4173`. On the host, open **http://127.0.0.1:4173**. Other devices must open a reachable IPv4 URL printed by the server, such as `http://192.168.1.20:4173` (example only). Do not open `0.0.0.0` on clients. Accept a firewall prompt only for a trusted private network.

1. Enter a display name and device type; create a room.
2. In **Invitations & controls**, choose the LAN connection address; share its QR/link or room code.
3. Join from another browser/device. Incognito or a separate browser profile gives a separate identity; two tabs share one identity.
4. **Send** files or text, select an online recipient and send the metadata-only offer.
5. The recipient accepts. Keep the sender page open while content uploads and is verified.
6. The recipient requests a native download, or reads/copies literal text.
7. Delete the transfer or close the room to revoke access and schedule cleanup.

**Default HTTP is unencrypted. The host operator can access content.** SHA-256 checks integrity, not malware, authenticity or encryption. Use a trusted local network and files you are comfortable sharing.

## What is implemented

- React/Vite dark utility workspace; local Inter fonts and locally generated QR codes.
- Fastify HTTP API, cookie sessions, CSRF and Host/Origin restrictions; no wildcard CORS or trusted proxy.
- Rooms with eight browser identities, owner controls, invitation rotation and session-aggregated WebSocket presence.
- Participant-private offers, atomic capacity reservations, sequential ≤1 MiB hashed file chunks, authoritative status reconciliation and streamed SHA-256 verification.
- Receiver-only attachment downloads with single byte ranges, immediate revocation and cleanup retries.
- UTF-8 byte-limited accepted text held in memory, plain-text downloads and manual copy fallback.
- Absolute/idle/offer/retention/disconnect/stall lifecycle rules; restart orphan cleanup in a dedicated owned directory.
- Scoped application goodput, retry ingress, acknowledged and download-stream emitted bytes; JSON export.

No database, accounts, cloud services, runtime internet dependency, network scanning, NAT traversal, restart persistence or upload resume after refresh. Selected `File` objects stay in this page's memory. A live original tab can recover short interruptions; a refreshed page cannot resume its unfinished sends.

## Configuration

Environment variables are read at startup; `.env` is **not** implicitly loaded. `.env.example` lists values. Either set variables in your shell, or after building use:

```sh
node --env-file=.env apps/server/dist/index.js
```

| Variable | Default / meaning |
| --- | --- |
| `HOST` | `0.0.0.0`, IPv4 listener |
| `PORT` | `4173` |
| `STORAGE_ROOT` | `.landrop/storage`; dedicated application-owned directory |
| `ALLOWED_ORIGINS` | Additional exact deployment origins, comma separated; never `*` |
| `TLS_KEY`, `TLS_CERT` | Both PEM file paths required for optional HTTPS |
| `DISK_BUDGET_BYTES` | `8589934592` reserved bytes (8 GiB) |
| `TEXT_BUDGET_BYTES` | `4194304` reserved bytes (4 MiB) |
| `MAX_ROOMS`, `MAX_SESSIONS` | `64`, `1024` |

Zero payload budgets disable admission for nonempty payloads. Never use a personal directory, a shared multi-host storage root, or a synchronized/network drive. LANDrop refuses a nonempty unmarked directory and never recursively clears one. It deletes only recognized UUID `.part` files inside its owned root. A process lease prevents a second running host from sweeping live content. Unknown files are left alone. Run one host per root; see [security](docs/security.md).

Addresses are discovered at startup. If your network/IP changes, restart the host. For a specific trusted DNS name or additional interface, explicitly configure its exact origin. No firewall rules are changed automatically.

## Development and verification

```sh
npm run dev                 # Fastify :4173 + Vite http://127.0.0.1:5173
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e             # production build, port 4173 must be free
```

The development proxy rewrites Origin/Host only for its local backend. Use the production server for LAN demonstrations. The browser suite retains the production rate limiter; it may wait a minute when many independent test contexts share loopback. Integration tests use isolated temporary directories and injected clocks. The opt-in 2 GiB test is `LANDROP_LARGE_FILE=1 npm run test:integration` on POSIX or `$env:LANDROP_LARGE_FILE='1'; npm run test:integration` in PowerShell; it needs disk/time and was **not** part of the observed default run.

Optional design inspection uses the supplied local `.agents/skills/design-taste-frontend` checkout (not a production or CI dependency), with the production server running:

```sh
node .agents/skills/design-taste-frontend/scripts/lint.mjs --app apps/web/src
node .agents/skills/design-taste-frontend/scripts/inspect.mjs --app http://127.0.0.1:4173
node scripts/inspect-authenticated.mjs
node scripts/inspect-states.mjs
```

## Documentation

- [Protocol, states, limits and errors](docs/protocol.md)
- [Networking, firewall troubleshooting and HTTPS](docs/networking.md)
- [Security and trust model](docs/security.md)
- [Five-minute demo and viva](docs/demo.md)
- [Verification evidence and pending physical checks](docs/verification.md)
- [Original supplied project guide](docs/source-guide.md)
- [Design decisions](docs/superpowers/specs/landrop-design.md)

Do not expose this classroom/private-LAN utility directly to the public internet. Deletion is not secure erasure, a download request does not prove saving, and application goodput is not raw link bandwidth.
