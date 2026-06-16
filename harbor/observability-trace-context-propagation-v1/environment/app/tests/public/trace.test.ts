import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startTaskServer, type RunningServer } from "../helpers/server";

let server: RunningServer | undefined;

async function ingress(base: string, headers?: Record<string, string>) {
  return fetch(`${base}/ingress`, { method: "POST", headers });
}

describe("trace context public", () => {
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

  test("ingress without traceparent creates trace", async () => {
    if (!server) throw new Error("no server");
    const res = await ingress(server.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trace_id).toMatch(/^[0-9a-f]{32}$/);
    const trace = await (await fetch(`${server.baseUrl}/trace/${body.trace_id}`)).json();
    expect(trace.spans.length).toBeGreaterThanOrEqual(4);
  });
});
