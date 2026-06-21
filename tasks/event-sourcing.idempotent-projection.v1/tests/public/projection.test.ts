import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

function append(baseUrl: string, body: object) {
  return fetch(`${baseUrl}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function projection(baseUrl: string, id: string) {
  return (
    await fetch(`${baseUrl}/projections/${encodeURIComponent(id)}`)
  ).json();
}

describe("idempotent projection public", () => {
  let server: RunningServer | undefined;

  beforeAll(async () => {
    server = await startTaskServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("append created and increment updates projection", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const agg = "pub-1";
    await append(server.baseUrl, {
      aggregate_id: agg,
      version: 1,
      type: "created",
      data: { name: "alpha" },
    });
    await append(server.baseUrl, {
      aggregate_id: agg,
      version: 2,
      type: "increment",
      data: { amount: 3 },
    });
    const state = await projection(server.baseUrl, agg);
    expect(state.name).toBe("alpha");
    expect(state.total).toBe(3);
    expect(state.last_version).toBe(2);
  });

  test("duplicate append is idempotent", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const agg = "pub-dup";
    const event = {
      aggregate_id: agg,
      version: 1,
      type: "increment",
      data: { amount: 2 },
    };
    await append(server.baseUrl, event);
    await append(server.baseUrl, event);
    expect((await projection(server.baseUrl, agg)).total).toBe(2);
  });
});
