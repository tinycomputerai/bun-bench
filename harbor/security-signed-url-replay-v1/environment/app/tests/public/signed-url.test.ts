import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

let server: RunningServer | undefined;

function sign(
  base: string,
  method: string,
  path: string,
  query?: Record<string, string>
) {
  return fetch(`${base}/sign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, path, query, ttl: 300 }),
  });
}

describe("signed url public", () => {
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

  test("valid signed url works once", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const signed = await (
      await sign(server.baseUrl, "GET", "/asset", { q: "1" })
    ).json();
    const res = await fetch(`${server.baseUrl}${signed.url}`);
    expect(res.status).toBe(200);
  });
});
