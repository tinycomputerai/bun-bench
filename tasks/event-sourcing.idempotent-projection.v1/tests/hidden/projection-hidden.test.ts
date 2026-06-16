import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startTaskServer, type RunningServer } from "../helpers/server";

async function append(baseUrl: string, body: object) {
  return fetch(`${baseUrl}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function projection(baseUrl: string, id: string) {
  return (await fetch(`${baseUrl}/projections/${encodeURIComponent(id)}`)).json();
}

async function rebuild(baseUrl: string, id: string) {
  return fetch(`${baseUrl}/projections/${encodeURIComponent(id)}/rebuild`, { method: "POST" });
}

describe("idempotent projection hidden", () => {
  let server: RunningServer | undefined;

  beforeAll(async () => {
    server = await startTaskServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("out-of-order events buffer until gap filled", async () => {
    if (!server) throw new Error("server did not start");
    const agg = "hid-order";
    await append(server.baseUrl, { aggregate_id: agg, version: 1, type: "created", data: { name: "x" } });
    await append(server.baseUrl, { aggregate_id: agg, version: 3, type: "increment", data: { amount: 5 } });
    expect((await projection(server.baseUrl, agg)).last_version).toBe(1);
    await append(server.baseUrl, { aggregate_id: agg, version: 2, type: "increment", data: { amount: 2 } });
    const state = await projection(server.baseUrl, agg);
    expect(state.total).toBe(7);
    expect(state.last_version).toBe(3);
  });

  test("version conflict on same version different payload", async () => {
    if (!server) throw new Error("server did not start");
    const agg = "hid-conflict";
    await append(server.baseUrl, { aggregate_id: agg, version: 1, type: "increment", data: { amount: 1 } });
    const conflict = await append(server.baseUrl, {
      aggregate_id: agg,
      version: 1,
      type: "increment",
      data: { amount: 9 },
    });
    expect(conflict.status).toBe(409);
  });

  test("large gap is rejected", async () => {
    if (!server) throw new Error("server did not start");
    const agg = "hid-gap";
    const response = await append(server.baseUrl, {
      aggregate_id: agg,
      version: 10,
      type: "created",
      data: { name: "nope" },
    });
    expect(response.status).toBe(409);
  });

  test("unknown event type is quarantined", async () => {
    if (!server) throw new Error("server did not start");
    const agg = "hid-poison";
    const resp = await append(server.baseUrl, {
      aggregate_id: agg,
      version: 1,
      type: "unknown-type",
      data: { x: 1 },
    });
    expect(resp.status).toBe(201);
    expect((await resp.json()).quarantined).toBe(true);
    expect((await projection(server.baseUrl, agg)).last_version).toBe(0);
  });

  test("rebuild matches incremental projection", async () => {
    if (!server) throw new Error("server did not start");
    const agg = "hid-rebuild";
    await append(server.baseUrl, { aggregate_id: agg, version: 1, type: "created", data: { name: "r" } });
    await append(server.baseUrl, { aggregate_id: agg, version: 2, type: "increment", data: { amount: 4 } });
    const incremental = await projection(server.baseUrl, agg);
    const rebuilt = await (await rebuild(server.baseUrl, agg)).json();
    expect(rebuilt).toEqual(incremental);
  });
});
