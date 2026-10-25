import { config } from "./config";
import { buildApp } from "./app";
const c = config();
const app = await buildApp(c);
try {
  await app.listen({ port: c.port, host: c.host });
} catch (error) {
  await app.close();
  throw error;
}
console.log("LANDrop — temporary LAN relay");
for (const address of c.addresses) console.log(`  ${address}`);
console.log(
  c.tlsKey
    ? "HTTPS enabled; clients must trust the certificate."
    : "HTTP is unencrypted. The host operator can access content.",
);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void app.close().then(() => process.exit(0));
  });
