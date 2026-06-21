import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

const TRACE_ID_RE = /^[0-9a-f]{32}$/;

let server: RunningServer | undefined;

function ingress(base: string, headers?: Record<string, string>) {
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
    if (!server) {
      throw new Error("no server");
    }
    expect((await fetch(`${server.baseUrl}/healthz`)).status).toBe(200);
  });

  test("ingress without traceparent creates trace", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const res = await ingress(server.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trace_id).toMatch(TRACE_ID_RE);
    const trace = await (
      await fetch(`${server.baseUrl}/trace/${body.trace_id}`)
    ).json();
    expect(trace.spans.length).toBeGreaterThanOrEqual(4);
  });
});
