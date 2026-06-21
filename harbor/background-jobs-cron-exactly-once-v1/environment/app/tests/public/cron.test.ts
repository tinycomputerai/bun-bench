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

describe("cron public", () => {
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

  test("job runs at least once", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const name = `pub-${Math.random().toString(36).slice(2)}`;
    await registerJob(server.baseUrl, name, 80);
    await sleep(350);
    const runs = await (
      await fetch(`${server.baseUrl}/runs?job=${name}`)
    ).json();
    const completed = runs.runs.filter(
      (r: { status: string }) => r.status === "completed"
    );
    expect(completed.length).toBeGreaterThan(0);
  }, 10_000);
});
