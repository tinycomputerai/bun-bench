import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function enqueue(baseUrl: string, key: string, payload: string) {
  return fetch(`${baseUrl}/enqueue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, payload }),
  });
}

async function processed(baseUrl: string) {
  return (await fetch(`${baseUrl}/processed`)).json();
}

describe("per-key fifo public", () => {
  let server: RunningServer | undefined;

  beforeAll(async () => {
    server = await startTaskServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("same-key items are processed in enqueue order", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const key = "pub-order";
    for (let i = 0; i < 5; i += 1) {
      await enqueue(server.baseUrl, key, `item-${i}`);
    }
    await sleep(200);
    const items = (await processed(server.baseUrl)).items.filter(
      (i: { key: string }) => i.key === key
    );
    expect(items.map((i: { payload: string }) => i.payload)).toEqual([
      "item-0",
      "item-1",
      "item-2",
      "item-3",
      "item-4",
    ]);
  });

  test("different keys can make progress concurrently", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    await enqueue(server.baseUrl, "pub-slow", "slow:150");
    await enqueue(server.baseUrl, "pub-fast", "ok");
    await sleep(80);
    const items = await processed(server.baseUrl);
    const fastDone = items.items.some(
      (i: { key: string }) => i.key === "pub-fast"
    );
    expect(fastDone).toBe(true);
  });
});
