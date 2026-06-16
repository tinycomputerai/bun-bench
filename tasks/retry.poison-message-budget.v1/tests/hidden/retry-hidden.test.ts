import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startTaskServer, type RunningServer } from "../helpers/server";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let server: RunningServer | undefined;

async function process(base: string, id: string, payload: string) {
  return fetch(`${base}/process`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, payload }),
  });
}

describe("retry hidden", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    await server?.stop();
  });

  test("permanent failure dead letters without many attempts", async () => {
    if (!server) throw new Error("no server");
    const id = `hid-perm-${Math.random().toString(36).slice(2)}`;
    await process(server.baseUrl, id, "permanent");
    await sleep(50);
    const status = await (await fetch(`${server.baseUrl}/status/${id}`)).json();
    expect(status.state).toBe("dead_letter");
    expect(status.attempts).toBe(1);
  });

  test("poison exhausts retry budget", async () => {
    if (!server) throw new Error("no server");
    const id = `hid-poison-${Math.random().toString(36).slice(2)}`;
    await process(server.baseUrl, id, "poison");
    await sleep(800);
    const status = await (await fetch(`${server.baseUrl}/status/${id}`)).json();
    expect(status.state).toBe("dead_letter");
    expect(status.attempts).toBe(4);
  }, 15000);

  test("transient retries then succeeds once", async () => {
    if (!server) throw new Error("no server");
    const id = `hid-trans-${Math.random().toString(36).slice(2)}`;
    await process(server.baseUrl, id, "transient:2");
    await sleep(400);
    const status = await (await fetch(`${server.baseUrl}/status/${id}`)).json();
    expect(status.state).toBe("completed");
    expect(status.side_effects).toBe(1);
  }, 10000);

  test("concurrent same id does not duplicate side effects", async () => {
    if (!server) throw new Error("no server");
    const id = `hid-conc-${Math.random().toString(36).slice(2)}`;
    await Promise.all([
      process(server.baseUrl, id, "ok"),
      process(server.baseUrl, id, "ok"),
      process(server.baseUrl, id, "ok"),
    ]);
    const status = await (await fetch(`${server.baseUrl}/status/${id}`)).json();
    expect(status.side_effects).toBe(1);
  });
});
