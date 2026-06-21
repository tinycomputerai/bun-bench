import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

function _sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let server: RunningServer | undefined;

function process(base: string, id: string, payload: string) {
  return fetch(`${base}/process`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, payload }),
  });
}

describe("retry public", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    await server?.stop();
  });

  test("healthz", async () => {
    if (!server) {
      throw new Error("no server");
    }
    expect((await fetch(`${server.baseUrl}/healthz`)).status).toBe(200);
  });

  test("ok payload completes", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const id = `pub-${Math.random().toString(36).slice(2)}`;
    const res = await process(server.baseUrl, id, "ok");
    expect(res.status).toBe(200);
    const status = await (await fetch(`${server.baseUrl}/status/${id}`)).json();
    expect(status.state).toBe("completed");
    expect(status.side_effects).toBe(1);
  });
});
