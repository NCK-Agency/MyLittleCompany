import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { brotliCompressSync } from "node:zlib";

// This is a known, valid fixture. Never send malformed/exploit Brotli input.
const [major, minor, patch] = process.versions.node.split(".").map(Number);
const patched = (major === 22 && (minor > 23 || (minor === 23 && patch >= 4)))
  || (major === 24 && (minor > 22 || (minor === 22 && patch >= 1)));
assert.ok(patched, `Unsupported or unpatched Node runtime: ${process.version}`);

const fixture = { message: "My Little Company remembers approved knowledge." };
const body = brotliCompressSync(Buffer.from(JSON.stringify(fixture)));
const server = createServer((_request, response) => {
  response.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Encoding": "br",
  });
  response.end(body);
});

server.listen(0, "127.0.0.1");
try {
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch(`http://127.0.0.1:${address.port}`, {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-encoding"), "br");
  assert.deepEqual(await response.json(), fixture);
  console.info(JSON.stringify({
    event: "node_brotli_smoke_passed",
    node: process.version,
    brotli: process.versions.brotli,
    undici: process.versions.undici,
  }));
} finally {
  if (server.listening) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
