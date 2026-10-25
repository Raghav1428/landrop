# Five-minute demonstration and viva

Before class: build/install with internet available; use the actual trusted demonstration Wi-Fi; allow the narrow private-network firewall rule; test the host LAN URL on a phone and another computer. These physical checks are pending until you actually observe them. Prepare a small harmless text file and a message containing `<script>literal</script>` and an emoji. Do not use private files.

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:40 | `npm start`, printed localhost and LAN URLs | One host relay; `0.0.0.0` is the listener, localhost is only this device, remote browsers use host IPv4 + port 4173. |
| 0:40–1:20 | Identify, create room, select LAN address, scan QR or enter code in another context | Browser identities, not scanned physical devices; tabs share cookies. QR joins a room, not Wi-Fi. |
| 1:20–2:05 | Send a small file offer; first reject it, then create another | Initial request contains only filename/size/IDs. No payload before approval. Acceptance also reserves capacity. |
| 2:05–2:55 | Accept and show transfer detail | Sender → host → receiver; sequential 1 MiB maximum chunks, acknowledged checkpoints, streamed full-file SHA-256. Hashes check integrity, not malware/encryption. |
| 2:55–3:25 | Receiver native download | Host streams verified content. “Download requested” is intentionally not “saved”; the browser cannot prove remote storage. |
| 3:25–4:00 | Offer/accept literal script-like text and emoji; copy/manual select | Content remains local until approval. UTF-8 byte limits differ from character counts; text is not executed as HTML. |
| 4:00–4:35 | Network insights and JSON export | Unique acknowledged vs retry ingress vs bytes emitted by the host. Goodput = useful acknowledged bytes / elapsed upload seconds, not bandwidth, RTT or packet loss. |
| 4:35–5:00 | Delete transfer or close room | Immediate authorization revocation first, cleanup second; failed unlink retries while keeping disk accounting. Restart restores no sessions/rooms. |

For a disconnect demonstration, use a **non-owner sender**: after readiness close that sender's tabs and show the receiver still downloads within retention. For a short-interruption demonstration, keep the original sender page open. Never imply resume after refresh; the UI explicitly warns that original files are lost.

## Short answers

- **Peer-to-peer?** No. Sender uploads to a temporary host; receiver downloads from it. No WebRTC.
- **Without internet?** After install/build, no external runtime service is used. LAN reachability is still required; same SSID does not guarantee it.
- **Why TCP and SHA-256?** TCP supplies an ordered reliable byte stream. SHA-256 additionally compares each application chunk and final stored file to the sender's digest.
- **Lost acknowledgement?** Ask the host for its committed offset/next chunk. Identical replays do not append twice.
- **Why HTTP and WebSocket?** HTTP carries operations/content; WS only invalidates snapshots, never file/text payloads.
- **Database?** No. Bounded in-memory Maps for metadata/sessions/text, temporary disk for files.
- **Secure?** Sessions, CSRF, Host/Origin, participant authorization, bounds and expiry are implemented. Default HTTP is unencrypted and the host is trusted. Optional trusted HTTPS protects transport, not content from the host.
- **What failed tests caught?** Escaped JSON exceeding a too-small request cap; malformed CSRF bytes; storage failure revocation; early-ready retention across a multi-file offer; text retry metrics. Show actual [evidence](verification.md), not imagined results.

The longer supplied [source guide](source-guide.md) remains available. Only claim physical phone testing or the 2 GiB opt-in test after actually observing it.
