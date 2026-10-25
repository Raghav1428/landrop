# Networking and HTTPS

## Find the correct address

LANDrop binds IPv4 `0.0.0.0:4173`, meaning all local IPv4 interfaces. The listener address is not a URL for clients. On the host use `http://127.0.0.1:4173` or `http://localhost:4173`. On another device, use the **host computer's** reachable LAN IPv4 address, not the phone's address and not localhost.

The server prints candidate URLs from local interfaces and exposes them in Invitations & controls. Select the interface your recipients can reach before copying a link or showing its QR. Virtual adapters/VPNs can add unusable candidates; there is no claim that every discovered address is reachable from every device. QR encodes the chosen host origin and a room secret in the URL fragment. It neither joins Wi-Fi nor transfers content nor scans nearby devices. The page removes the fragment from browser history/address bar and holds the invitation locally until joining.

For manual address discovery:

- Windows: `ipconfig` in PowerShell/Command Prompt, IPv4 Address of the active Wi-Fi/Ethernet interface.
- macOS: System Settings → Network → active interface → Details → TCP/IP, or `ipconfig getifaddr en0` (interface can differ).
- Linux: `ip -4 addr`, select the active local interface, not a loopback/bridge unless intended.

Restart the server after changing network interfaces/IPs; the allowlist is intentionally fixed at startup to resist DNS rebinding. To use a deliberate extra DNS origin, set e.g. `ALLOWED_ORIGINS=http://landrop.local:4173`. It must be an exact origin, without path, wildcard or credentials; DNS must already resolve correctly. Do not add arbitrary external origins. Requests still require a matching Host/Origin for that deployment.

## If a phone cannot connect

1. Keep the host awake and the server running; verify its localhost health/UI first.
2. Check the host LAN IP and port; never substitute `0.0.0.0` or phone localhost.
3. Confirm clients can reach the host. Identical Wi-Fi names are not proof of connectivity.
4. Allow inbound TCP 4173 on the host's **private/trusted** network firewall profile. Do not disable the firewall globally or open the public profile. No automatic firewall changes are made.
5. Check VPN routing, multiple subnets, guest-network/client isolation, campus access policies, or a mobile connection that switched off Wi-Fi. Ask the network administrator; do not try to bypass institutional controls.
6. Confirm no other program uses port 4173. A second LANDrop process must use its own dedicated storage directory and port.
7. Try a small file before large ones. Inspect the UI's real error and Network Insights rather than assuming a Wi-Fi speed.

On Windows, use Windows Security → Firewall & network protection → Allow an app, or an administrator-created narrow inbound TCP rule for Node/4173 on the private profile. On macOS, approve Node under System Settings → Network → Firewall → Options as appropriate. On Linux, use your distribution's firewall tooling to permit only the required trusted subnet/port (for example a scoped UFW rule). Exact policy is operator-specific; no privileged commands are run by this project.

## Optional HTTPS

Supply a valid certificate/key pair trusted by all client browsers and valid for the selected hostname/IP SAN:

```sh
# POSIX shell
TLS_KEY=./certs/key.pem TLS_CERT=./certs/cert.pem npm start
```

```powershell
$env:TLS_KEY='./certs/key.pem'
$env:TLS_CERT='./certs/cert.pem'
npm start
```

Use a local CA tool such as mkcert or your organization's certificate service, install trust on each demonstration device, and keep private keys out of Git. A merely self-signed/untrusted certificate may cause browser/WS failure; do not claim it is trusted HTTPS. Update allowed origins and invitation address to the actual HTTPS origin. Both paths must be present and readable at startup. Sessions use Secure cookies under TLS.

HTTPS encrypts browser-to-host transport. It **does not** hide content from the host operator. HTTP remains the default and has a persistent trust notice. Hashing uses an incremental worker implementation even on insecure LAN HTTP. Clipboard APIs may be unavailable on HTTP; LANDrop selects the literal text/link and explains manual copy instead. Downloads are native links, not whole-file blobs. All scripts/fonts/QR code generation are local after build, with no CDN or external runtime requests.

## What the network stack does

Application: HTTP + WebSocket; transport: TCP; network: IPv4 deployment; link: Wi-Fi/Ethernet. LANDrop adds consent, chunk integrity, capacity reservations, checkpoints, authorization and cleanup. It does not implement TCP reliability/congestion control, routing, packet capture, NAT traversal, RTT/packet-loss measurement or direct WebRTC transfer. One 1 MiB application chunk is not one TCP packet.

Physical Wi-Fi, phone, multi-computer, firewall and internet-disconnected acceptance remain manual pending checks in [verification](verification.md).
