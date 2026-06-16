import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startTaskServer, type RunningServer } from "../helpers/server";

let server: RunningServer | undefined;

async function createUpload(base: string, total: number) {
  return fetch(`${base}/uploads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ total_size: total }),
  });
}

async function putChunk(base: string, id: string, offset: number, data: Uint8Array) {
  return fetch(`${base}/uploads/${id}/chunks?offset=${offset}`, { method: "PUT", body: data });
}

describe("resumable upload hidden", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    await server?.stop();
  });

  test("incomplete upload rejected at complete", async () => {
    if (!server) throw new Error("no server");
    const created = await (await createUpload(server.baseUrl, 10)).json();
    await putChunk(server.baseUrl, created.upload_id, 0, Buffer.from("12345"));
    const res = await fetch(`${server.baseUrl}/uploads/${created.upload_id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sha256: "0".repeat(64) }),
    });
    expect(res.status).toBe(409);
  });

  test("duplicate chunk offset is idempotent", async () => {
    if (!server) throw new Error("no server");
    const payload = Buffer.from("duplicate-test");
    const created = await (await createUpload(server.baseUrl, payload.length)).json();
    await putChunk(server.baseUrl, created.upload_id, 0, payload);
    await putChunk(server.baseUrl, created.upload_id, 0, payload);
    const hash = createHash("sha256").update(payload).digest("hex");
    const done = await fetch(`${server.baseUrl}/uploads/${created.upload_id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sha256: hash }),
    });
    expect(done.status).toBe(200);
  });

  test("bad checksum rejected", async () => {
    if (!server) throw new Error("no server");
    const payload = Buffer.from("checksum-fail");
    const created = await (await createUpload(server.baseUrl, payload.length)).json();
    await putChunk(server.baseUrl, created.upload_id, 0, payload);
    const res = await fetch(`${server.baseUrl}/uploads/${created.upload_id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sha256: "f".repeat(64) }),
    });
    expect(res.status).toBe(422);
  });
});
