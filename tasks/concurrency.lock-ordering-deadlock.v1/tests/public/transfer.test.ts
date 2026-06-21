import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

let server: RunningServer | undefined;

function transfer(base: string, from: string, to: string, amount: number) {
  return fetch(`${base}/transfer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from, to, amount }),
  });
}

describe("lock ordering public", () => {
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
    const res = await fetch(`${server.baseUrl}/healthz`);
    expect(res.status).toBe(200);
  });

  test("transfer updates balances", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const res = await transfer(server.baseUrl, "a", "b", 100);
    expect(res.status).toBe(200);
    const a = await (await fetch(`${server.baseUrl}/accounts/a`)).json();
    const b = await (await fetch(`${server.baseUrl}/accounts/b`)).json();
    expect(a.balance).toBe(900);
    expect(b.balance).toBe(1100);
  });
});
