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

async function totalBalance(base: string): Promise<number> {
  let sum = 0;
  for (const id of ["a", "b", "c", "d"]) {
    const acct = await (await fetch(`${base}/accounts/${id}`)).json();
    sum += acct.balance;
  }
  return sum;
}

describe("lock ordering hidden", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    await server?.stop();
  });

  test("opposite transfers do not deadlock", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const results = await Promise.all([
      transfer(server.baseUrl, "a", "b", 10),
      transfer(server.baseUrl, "b", "a", 10),
      transfer(server.baseUrl, "a", "b", 10),
      transfer(server.baseUrl, "b", "a", 10),
    ]);
    for (const r of results) {
      expect(r.status).toBe(200);
    }
  }, 10_000);

  test("disjoint transfers complete concurrently", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const start = Date.now();
    await Promise.all([
      transfer(server.baseUrl, "a", "b", 5),
      transfer(server.baseUrl, "c", "d", 5),
    ]);
    expect(Date.now() - start).toBeLessThan(3000);
  });

  test("total balance conserved", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const before = await totalBalance(server.baseUrl);
    await Promise.all([
      transfer(server.baseUrl, "a", "c", 25),
      transfer(server.baseUrl, "b", "d", 25),
      transfer(server.baseUrl, "d", "a", 10),
    ]);
    const after = await totalBalance(server.baseUrl);
    expect(after).toBe(before);
  });
});
