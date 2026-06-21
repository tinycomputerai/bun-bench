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

async function status(baseUrl: string) {
  return (await fetch(`${baseUrl}/status`)).json();
}

describe("per-key fifo hidden", () => {
  let server: RunningServer | undefined;

  beforeAll(async () => {
    server = await startTaskServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("fail-once retry stays ahead of later same-key jobs", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const key = "hid-retry-order";
    await enqueue(server.baseUrl, key, "fail-once:a");
    await enqueue(server.baseUrl, key, "after");
    await sleep(250);
    const items = (await processed(server.baseUrl)).items.filter(
      (i: { key: string }) => i.key === key
    );
    expect(items.map((i: { payload: string }) => i.payload)).toEqual([
      "fail-once:a",
      "after",
    ]);
  });

  test("never more than one in-flight job per key", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    await enqueue(server.baseUrl, "hid-lock", "slow:200");
    await sleep(20);
    for (let i = 0; i < 10; i += 1) {
      const snap = await status(server.baseUrl);
      const sameKey = snap.in_flight.filter(
        (e: { key: string }) => e.key === "hid-lock"
      );
      expect(sameKey.length).toBeLessThanOrEqual(1);
      await sleep(10);
    }
  });

  test("crash redelivery is idempotent in processed log", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    await enqueue(server.baseUrl, "hid-crash", "crash");
    await sleep(300);
    const items = (await processed(server.baseUrl)).items.filter(
      (i: { key: string }) => i.key === "hid-crash"
    );
    expect(items.length).toBe(1);
    expect(items[0].payload).toBe("crash");
  });

  test("backpressure returns 429 when per-key depth exceeded", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const key = "hid-backpressure";
    await enqueue(server.baseUrl, key, "slow:300");
    let blocked = 0;
    for (let i = 0; i < 55; i += 1) {
      const r = await enqueue(server.baseUrl, key, "fill");
      if (r.status === 429) {
        blocked += 1;
      }
    }
    expect(blocked).toBeGreaterThan(0);
  });

  test("key_sequence increments per key", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const key = "hid-seq";
    await enqueue(server.baseUrl, key, "a");
    await enqueue(server.baseUrl, key, "b");
    await sleep(150);
    const items = (await processed(server.baseUrl)).items.filter(
      (i: { key: string }) => i.key === key
    );
    expect(items.map((i: { key_sequence: number }) => i.key_sequence)).toEqual([
      1, 2,
    ]);
  });
});
