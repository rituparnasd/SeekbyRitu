import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import tls from "node:tls";
import { databaseOptions } from "../lib/database-config.mjs";
test("database options always verify TLS and reject non-CA input", () => {
  const options = databaseOptions(
    "postgres://fixture:password@localhost/db?sslmode=no-verify",
  );
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.connectionString.includes("sslmode"), false);
  assert.throws(() => databaseOptions("https://localhost/db"));
  assert.throws(
    () => databaseOptions("postgres://localhost/db", "not a certificate"),
    { code: "SEEK_DATABASE_CA_FORMAT" },
  );
});
test("provider CA enables a verified connection while untrusted and wrong-host certificates fail", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seek-ca-"));
  let server;
  try {
    const run = (args) =>
      execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
    run([
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      "ca.key",
      "-out",
      "ca.crt",
      "-days",
      "1",
      "-subj",
      "/CN=Seek Local Test CA",
      "-addext",
      "basicConstraints=critical,CA:TRUE",
    ]);
    run([
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      "leaf.key",
      "-out",
      "leaf.csr",
      "-subj",
      "/CN=localhost",
    ]);
    await writeFile(
      join(dir, "extensions"),
      "subjectAltName=DNS:localhost\nbasicConstraints=CA:FALSE\n",
    );
    run([
      "x509",
      "-req",
      "-in",
      "leaf.csr",
      "-CA",
      "ca.crt",
      "-CAkey",
      "ca.key",
      "-CAcreateserial",
      "-out",
      "leaf.crt",
      "-days",
      "1",
      "-extfile",
      "extensions",
    ]);
    const ca = await readFile(join(dir, "ca.crt"), "utf8");
    server = tls.createServer(
      {
        key: await readFile(join(dir, "leaf.key")),
        cert: await readFile(join(dir, "leaf.crt")),
      },
      (socket) => socket.end(),
    );
    server.on("tlsClientError", () => {});
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const connect = (options) =>
      new Promise((resolve, reject) => {
        const socket = tls.connect(
          {
            host: "127.0.0.1",
            port: server.address().port,
            servername: "localhost",
            ...options,
          },
          () => {
            socket.end();
            resolve();
          },
        );
        socket.on("error", reject);
      });
    await assert.rejects(
      connect(databaseOptions("postgres://localhost/db").ssl),
    );
    await connect(databaseOptions("postgres://localhost/db", ca).ssl);
    await assert.rejects(
      connect({
        ...databaseOptions("postgres://localhost/db", ca).ssl,
        servername: "wrong.example",
      }),
      { code: "ERR_TLS_CERT_ALTNAME_INVALID" },
    );
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});
