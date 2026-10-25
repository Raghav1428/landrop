# LANDrop — Project Explanation and Viva Guide

This guide explains what LANDrop does, how it works step by step, the technologies involved, and how to answer likely teacher/viva questions.

## 1. What does the project do?

**LANDrop is a browser-based application for sharing files and plain text between devices on a reachable local network, without creating accounts or using cloud storage.**

One computer runs the application server. Other devices open that computer's local network address in their browsers, join a temporary room, and share content.

The important feature is **receiver approval**: the sender first sends an offer, and actual content is sent only after the receiver accepts it.

### What to say to your teacher

> My project, LANDrop, is a local-network file and text sharing application. One computer acts as a temporary host, and other devices connect through their browsers using the host's LAN IP address. Users join a room through a QR invitation or room code. The receiver must approve a transfer before content is uploaded. Files are uploaded in chunks, checked using SHA-256, temporarily stored on the host, and then made available for the receiver to download.

## 2. What problem does it solve?

Suppose you want to move a file from your laptop to your phone. Common options include:

- Uploading it to cloud storage.
- Sending it through a messaging service.
- Using a cable.
- Installing another application.

LANDrop provides a different option: **use the existing local network and a browser, with no user account or cloud relay.**

After dependencies are installed and the application is built, normal operation does not require internet access. Devices must still be able to communicate with the host over the local network.

**Important:** Connecting to the same Wi-Fi name does not always guarantee connectivity. Guest networks and campus networks may block communication between devices.

## 3. Architecture

The project uses a **client–server architecture with a temporary relay server**.

```text
Sender's browser
       |
       | File upload over HTTP
       v
LANDrop host computer
  - Checks permissions
  - Stores temporary file
  - Verifies checksum
       |
       | File download over HTTP
       v
Receiver's browser
```

### Three roles

| Role | Responsibility |
| --- | --- |
| Sender | Selects content and offers it to a recipient |
| Host/server | Manages rooms, permissions, transfers, storage and cleanup |
| Receiver | Accepts or rejects offers and downloads accepted files |

The host computer can also open the application in its own browser and participate.

### Is it peer-to-peer?

**No. This is not direct peer-to-peer file sharing.**

```text
Sender → Host → Receiver
```

Files do not go directly from the sender's browser to the receiver's browser using WebRTC.

## 4. Technologies used and why

| Technology | Purpose |
| --- | --- |
| React | Builds the browser interface |
| TypeScript | Provides type checking across the application |
| Vite | Runs frontend development tooling and builds frontend assets |
| Node.js | Runs the backend |
| Fastify | Handles API requests and serves the built frontend |
| HTTP | Carries commands, file chunks, text and downloads |
| WebSocket | Notifies browsers when room state changes |
| Zod | Validates request and response structures at runtime |
| SHA-256 | Checks uploaded chunks and the complete stored file |
| Web Worker | Performs browser-side hashing away from the main UI thread |
| Local filesystem | Holds temporary uploaded files |
| Vitest / Playwright | Support automated unit/integration and browser testing |

### Does it use a database?

**No.**

- Sessions, rooms and transfer metadata are held in server memory using `Map` structures.
- Uploaded files are stored temporarily on disk.
- Accepted text is held temporarily in server memory.

Restarting the host does not restore old rooms or sessions.

## 5. Complete workflow, step by step

### Step 1: Start the host

After installing dependencies and building:

```bash
npm start
```

The server normally listens on port **4173** and binds to:

```text
0.0.0.0:4173
```

This means it listens on the computer's IPv4 interfaces.

**`0.0.0.0` is a listening address, not the address users should open.**

The host itself can open:

```text
http://127.0.0.1:4173
```

Other devices need the host's reachable LAN address, for example:

```text
http://192.168.1.20:4173
```

That IP is only an example. The real address depends on the network.

**Teacher explanation:**

> The server listens for connections on the configured port. Remote devices connect using the host's local IPv4 address and that port.

### Step 2: Create a browser identity

The user enters a display name and device type. The server creates or reuses a temporary session.

It uses:

- A session cookie to recognize the browser.
- A CSRF token to protect state-changing requests.

No username/password account is created.

The identity represents a **browser session**, not verified physical hardware. Two tabs in the same browser profile share the cookie identity.

> The device list is a list of joined application sessions, not a scan of all devices connected to Wi-Fi.

### Step 3: Create a room

A user creates a temporary room and becomes its owner.

The room has:

- An owner.
- A room code and invitation secret.
- A list of joined members.
- Lock and expiry information.

The application can display an invitation as a locally generated QR code.

The owner can:

- Lock the room against new joins.
- Rotate the invitation.
- Remove members.
- Close the room.

Rotating the invitation invalidates old invitation details without removing existing members.

### Step 4: Another device joins

The other device opens the host's LAN URL and joins using:

- The QR invitation, or
- The room code.

The server checks whether the invitation is valid and whether the room can accept another member.

The project allows **up to eight joined devices per room**.

#### What the QR code actually does

It provides the selected host URL and room invitation information.

It does not:

- Transfer files.
- Automatically connect the phone to Wi-Fi.
- Discover every nearby device.

### Step 5: Sender creates an offer

The sender selects an online recipient and chooses files or text.

For files, the initial offer includes metadata such as:

- Filename.
- File size.
- File identifier.

For text, it includes the UTF-8 byte length, not the message itself.

**The actual file bytes or text are not included in the initial offer.**

> Sending only metadata first allows the receiver to consent before the application sends the actual content.

An unanswered offer expires after **two minutes**.

### Step 6: Receiver accepts or rejects

If the receiver rejects, no content upload begins.

If the receiver accepts, the server reserves the required storage or text budget. This helps prevent several accepted transfers from collectively exceeding the configured application capacity.

> Acceptance is also a resource-admission step: the server checks and reserves capacity before allowing content delivery.

### Step 7: Files upload in chunks

After acceptance, the sender uploads the file in sequential chunks. Each chunk is at most:

```text
1 MiB = 1,048,576 bytes
```

For each chunk:

1. The browser reads that section of the file.
2. The browser computes its SHA-256 checksum.
3. The browser sends the chunk and checksum to the host.
4. The host checks authorization, ordering, length and checksum.
5. The host writes the chunk to disk.
6. The host acknowledges the committed progress.
7. The sender continues with the next chunk.

```text
Sender                          Host
  |                               |
  |--- Chunk 0 + checksum -------->|
  |<-- Acknowledgment -------------|
  |--- Chunk 1 + checksum -------->|
  |<-- Acknowledgment -------------|
  |--- Chunk 2 + checksum -------->|
  |<-- Acknowledgment -------------|
```

#### Why use chunks?

- Memory use stays bounded.
- The application can show acknowledged upload progress.
- Interrupted requests can be reconciled.
- The server can enforce ordering and capacity.
- The full file does not need to be buffered in memory.

**A 1 MiB application chunk is not a TCP packet.** TCP divides the underlying byte stream into its own segments.

### Step 8: Recover from short interruptions

Suppose the host stores a chunk, but the sender never receives its acknowledgment. The sender must not blindly assume the chunk failed.

Instead, it requests upload status:

```text
What is the next expected chunk?
How many bytes are committed?
```

The sender continues from the host's confirmed state.

Identical replays do not append duplicate content. Conflicting data or out-of-order chunks are rejected.

#### Limitation

Recovery depends on the browser still holding the original selected `File` objects.

**Refreshing the page loses those file references.** The application does not provide full restart-after-refresh resume.

### Step 9: Verify the complete file

Once every chunk is uploaded:

1. The sender supplies the full-file SHA-256 digest.
2. The host streams the stored file through its own SHA-256 calculation.
3. The host compares the two digests.
4. If they match, the file becomes **ready**.
5. If they differ, verification fails.

The normal file states are:

```text
queued → uploading → verifying → ready
```

#### Why check both chunks and the complete file?

- Chunk checks validate individual upload units.
- The final check validates the complete assembled file stored on the host.

#### What SHA-256 does not prove

It does not prove that:

- The file is malware-free.
- The sender is authentic.
- The connection is encrypted.
- The receiver has saved the file correctly.

> SHA-256 is used for application-level integrity checking, not encryption or malware scanning.

### Step 10: Receiver downloads

Once the file is ready, the authorized receiver requests a native browser download.

The host streams the file from disk rather than loading the entire file into a JavaScript blob. The download implementation also supports single HTTP byte ranges.

#### Why does the UI say “Download requested”?

The application cannot prove that the receiver actually saved the file. It can observe a request and bytes emitted by the host, but not successful storage on another device.

### Step 11: Text sharing

Text follows a similar consent flow:

```text
Offer containing byte length
          ↓
Receiver accepts
          ↓
Sender submits actual text
          ↓
Receiver reads, copies or downloads it
```

Text is displayed literally, not interpreted as HTML.

For example:

```html
<script>alert("hello")</script>
```

should appear as text rather than execute.

The maximum message size is **64 KiB in UTF-8 bytes**. Bytes and characters are not equivalent, especially for emoji and non-English text.

### Step 12: Expiry and cleanup

LANDrop is temporary sharing, not permanent storage.

| Item | Limit |
| --- | --- |
| Files per offer | 20 |
| Size per file and per offer | 2 GiB |
| Chunk size | 1 MiB |
| Joined devices per room | 8 |
| Unanswered offer lifetime | 2 minutes |
| Verified-file / delivered-text retention | Up to 30 minutes while the room survives |
| Room maximum lifetime | Up to 8 hours, also bounded by the owner's session |
| Idle room closure | 60 minutes without activity/active transfers |
| Participant disconnect grace for unfinished work | 60 seconds |

When a transfer is deleted or a room closes:

1. Access is revoked immediately.
2. Relevant active work is stopped.
3. Disk cleanup proceeds.
4. The storage reservation is released after deletion succeeds.

If deletion fails, the application retries.

**Revoking access is not the same as completing disk deletion, and disk deletion is not secure erasure.**

## 6. Why use both HTTP and WebSocket?

### HTTP handles operations and content

Examples:

- Creating a session.
- Joining a room.
- Creating or accepting offers.
- Uploading chunks.
- Downloading files.
- Sending accepted text.

### WebSocket handles change notifications

When room state changes, the server notifies connected browsers. The browser then fetches a fresh room snapshot through HTTP.

```text
Something changes
       ↓
WebSocket notification
       ↓
Browser requests fresh state
       ↓
Interface updates
```

**The project does not send file contents through WebSocket.**

## 7. Connection to Computer Networks

The project demonstrates real networking at several layers:

```text
Application:    LANDrop / HTTP / WebSocket
Transport:      TCP
Network:        IP, specifically IPv4 deployment here
Link:           Wi-Fi or Ethernet
```

| Concept | Connection to the project |
| --- | --- |
| Client–server model | Browsers communicate with a central host |
| IP addressing | Devices locate the host using its LAN IPv4 address |
| Port numbers | Port 4173 identifies the listening application |
| TCP | Provides an ordered, reliable byte stream |
| HTTP | Provides request/response operations and file transfer |
| WebSocket | Provides persistent state-change notifications |
| Error detection | SHA-256 checks chunks and stored files |
| Application flow control | Sequential chunks and bounded concurrent operations |
| Session management | Cookies identify browser sessions |
| Authorization | Server checks who may access each transfer |

### What not to claim

The project does not implement:

- TCP itself.
- Routing algorithms.
- TCP congestion control.
- Wi-Fi device discovery.
- Packet capture.
- WebRTC or NAT traversal.

It uses the networking services provided by the operating system and standard protocols.

## 8. What do Network Insights measure?

The insights panel reports **application-level measurements**.

- **Logical bytes:** Unique content size offered.
- **Acknowledged bytes:** Content the host has confirmed as committed/delivered.
- **Ingress bytes:** Upload bytes received by the host, including repeated attempts.
- **Served bytes:** Bytes emitted by the host's download stream.
- **Verification duration:** Time spent verifying stored content.

A basic upload goodput formula is:

```text
Goodput = Unique acknowledged bytes / Elapsed upload time
```

Example:

```text
10 MiB acknowledged in 5 seconds
= 2 MiB/s application goodput
```

This is an illustration, not a measured result from the project.

### Goodput versus bandwidth

> Bandwidth describes link capacity. My application's goodput describes useful acknowledged content transferred per unit time.

The application does not measure packet loss, TCP retransmissions, RTT, congestion windows or raw network bandwidth.

## 9. Security: explain this honestly

The project includes:

- Cookie-based sessions.
- CSRF protection.
- Host and Origin validation.
- Authorized WebSocket connections.
- Participant-scoped transfer access.
- Request and rate limits.
- Safe handling of filenames.
- Literal text rendering.
- Temporary expiry and cleanup.
- Optional HTTPS.

However:

> **Default HTTP traffic is unencrypted, and the host operator can access shared content.**

Optional HTTPS protects browser-to-host transport when configured with a valid, trusted certificate. It still does not hide content from the host.

Also distinguish:

- **Room owner:** Has room-management permissions.
- **Host operator:** Controls the server and filesystem.

The room owner does not automatically gain API access to transfers between two other members, but the host operator remains trusted.

## 10. Important code locations

Paths below are relative to the project root.

| Location | Responsibility |
| --- | --- |
| `apps/web/src/` | React frontend |
| `apps/server/src/` | Backend services and API routes |
| `packages/protocol/src/` | Shared schemas, types, limits and errors |
| `apps/server/src/app.ts` | Assembles the Fastify application and services |
| `apps/server/src/core/store.ts` | In-memory session, room and transfer records |
| `apps/server/src/rooms/` | Room creation, membership and controls |
| `apps/server/src/security/` | Sessions and request security |
| `apps/web/src/transfer/controller.ts` | Browser upload sequencing, progress and retry handling |
| `apps/web/src/workers/` | Browser-side hashing |
| `apps/server/src/transfers/chunk-upload.ts` | Chunk validation, checksums and disk writes |
| `apps/server/src/transfers/finalize.ts` | Full-file verification |
| `apps/server/src/downloads/` | Authorized streaming downloads and ranges |
| `apps/server/src/text/` | Accepted text delivery |
| `apps/server/src/lifecycle/` | Expiry and cleanup coordination |
| `apps/server/src/metrics/` | Scoped metrics and export |
| `tests/e2e/` | Browser-level test scenarios |

## 11. Likely viva questions and short answers

### Is this peer-to-peer?

> No. It uses a temporary host relay: the sender uploads to the host, and the receiver downloads from the host.

### Does it work without internet?

> After installation and build, the application does not need external services at runtime. It still needs a reachable local network.

### Why is TCP used?

> The HTTP and WebSocket connections used here rely on TCP for reliable, ordered transport. The operating system handles TCP; my application adds consent, chunk tracking, verification and lifecycle management.

### Why use SHA-256 if TCP is already reliable?

> TCP provides transport reliability. SHA-256 adds an application-level comparison of each chunk and the complete stored file against the sender's digest.

### Why not upload the whole file in one request?

> Bounded chunks reduce buffering, provide progress checkpoints and make short interruptions easier to reconcile.

### What if an acknowledgment is lost?

> The sender asks the server for committed progress and the next expected chunk. Identical repeated chunks do not get appended twice.

### What if the sender refreshes?

> The browser loses the original selected file references, so the application cannot automatically resume that upload after refresh.

### Can the receiver download after the sender disconnects?

> Yes, if the file is already verified and remains available within its retention period and room lifetime.

### Does a matching checksum mean the file is safe?

> No. It means the stored bytes match the supplied digest. It does not mean the file is malware-free or authentic.

### What happens when the host shuts down?

> The service becomes unavailable. Sessions and rooms are in memory, so they do not survive a restart. Startup removes recognized orphan files from its application-owned storage.

### Why might a phone fail to connect?

> Possible reasons include using localhost instead of the host LAN IP, a firewall rule, a VPN, the wrong port, a separate subnet, or access-point client isolation.

### Can it scan all devices on Wi-Fi?

> No. It only shows browser sessions that joined the room.

### How did you test it?

> The repository includes Vitest tests and Playwright browser scenarios for sharing, security, recovery, lifecycle and other behavior.

**Only claim that a test passed or a physical phone was tested if you actually ran it and observed the result.**

## 12. Five-minute demonstration

1. **Introduce the architecture.** Explain that one computer is the temporary relay host.
2. **Show the address.** Distinguish localhost from the host's LAN IPv4 address.
3. **Create a room and join from another browser/device.** Explain the room code or QR invitation.
4. **Send a small file offer.** Point out that no content uploads before acceptance.
5. **Accept and show the stages.** Explain uploading, verification and readiness.
6. **Request a download.** Explain why this is not proof of saving.
7. **Share a short text message.** Show literal text handling.
8. **Show Network Insights.** Explain application goodput, not raw bandwidth.
9. **Delete the transfer or close the room.** Explain immediate revocation and subsequent cleanup.

Use test files and a trusted private network. Test the actual demonstration setup beforehand.

## 13. Final summary to memorize

> LANDrop is a temporary local-network file and text sharing application built with React, TypeScript, Node.js and Fastify. Devices join a room through a QR invitation or room code without creating accounts. The sender first sends metadata, and actual content is transmitted only after the receiver accepts. Files upload to the host in sequential 1 MiB chunks, with SHA-256 checks for chunks and the complete stored file. The receiver then downloads the verified file from the host. HTTP carries commands and content, while WebSocket notifications keep room state updated. The project demonstrates client–server networking, IPv4 addressing, TCP-based communication, application-level integrity, authorization and temporary resource management. It is a host relay, not direct peer-to-peer sharing, and default HTTP traffic is not encrypted.

**Remember this sequence:**

```text
Connect → Identify → Join room → Offer → Accept → Upload → Verify → Download → Expire and clean up
```

## Further reading

- [Project README](../README.md)
- [Protocol and lifecycle](protocol.md)
- [Networking and HTTPS](networking.md)
- [Security and trust model](security.md)
- [Course demonstration](demo.md)
- [Verification evidence](verification.md)
