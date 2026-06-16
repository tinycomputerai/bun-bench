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

describe("resumable upload public", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    await server?.stop();
  });

  test("healthz", async () => {
    if (!server) throw new Error("no server");
    expect((await fetch(`${server.baseUrl}/healthz`)).status).toBe(200);
  });

  test("out of order chunks complete with checksum", async () => {
    if (!server) throw new Error("no server");
    const payload = Buffer.from("hello-resumable-world");
    const created = await (await createUpload(server.baseUrl, payload.length)).json();
    const half = Math.floor(payload.length / 2);
    await putChunk(server.baseUrl, created.upload_id, half, payload.subarray(half));
    await putChunk(server.baseUrl, created.upload_id, 0, payload.subarray(0, half));
    const hash = createHash("sha256").update(payload).digest("hex");
    const done = await fetch(`${server.baseUrl}/uploads/${created.upload_id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sha256: hash }),
    });
    expect(done.status).toBe(200);
    const status = await (await fetch(`${server.baseUrl}/uploads/${created.upload_id}`)).json();
    expect(status.complete).toBe(true);
  });
});
