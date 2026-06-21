import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let server: RunningServer | undefined;

function registerJob(
  base: string,
  name: string,
  interval: number,
  policy?: string
) {
  return fetch(`${base}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      interval_ms: interval,
      missed_policy: policy,
    }),
  });
}

function slotCounts(runs: Array<{ scheduled_time: number; status: string }>) {
  const bySlot = new Map<number, string[]>();
  for (const r of runs) {
    const list = bySlot.get(r.scheduled_time) ?? [];
    list.push(r.status);
    bySlot.set(r.scheduled_time, list);
  }
  return bySlot;
}

describe("cron hidden", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    await server?.stop();
  });

  test("no duplicate completed runs per slot", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const name = `hid-dedup-${Math.random().toString(36).slice(2)}`;
    await registerJob(server.baseUrl, name, 60);
    await sleep(500);
    const runs = (
      await (await fetch(`${server.baseUrl}/runs?job=${name}`)).json()
    ).runs;
    const completed = runs.filter(
      (r: { status: string }) => r.status === "completed"
    );
    const slots = new Set(
      completed.map((r: { scheduled_time: number }) => r.scheduled_time)
    );
    expect(completed.length).toBe(slots.size);
  }, 10_000);

  test("skip policy records skipped slots under overlap", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const name = `hid-skip-${Math.random().toString(36).slice(2)}`;
    await registerJob(server.baseUrl, name, 40, "skip");
    await sleep(350);
    const runs = (
      await (await fetch(`${server.baseUrl}/runs?job=${name}`)).json()
    ).runs;
    expect(runs.some((r: { status: string }) => r.status === "skipped")).toBe(
      true
    );
    const completed = runs.filter(
      (r: { status: string }) => r.status === "completed"
    );
    const slots = new Set(
      completed.map((r: { scheduled_time: number }) => r.scheduled_time)
    );
    expect(completed.length).toBe(slots.size);
  }, 10_000);

  test("overlap marks skipped while running", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const name = `hid-overlap-${Math.random().toString(36).slice(2)}`;
    await registerJob(server.baseUrl, name, 30);
    await sleep(250);
    const runs = (
      await (await fetch(`${server.baseUrl}/runs?job=${name}`)).json()
    ).runs;
    const bySlot = slotCounts(runs);
    const sawSkipped = runs.some(
      (r: { status: string }) => r.status === "skipped"
    );
    for (const statuses of bySlot.values()) {
      const running = statuses.filter(
        (s) => s === "running" || s === "completed"
      ).length;
      expect(running).toBeLessThanOrEqual(1);
    }
    expect(sawSkipped || runs.length > 0).toBe(true);
  }, 10_000);
});
