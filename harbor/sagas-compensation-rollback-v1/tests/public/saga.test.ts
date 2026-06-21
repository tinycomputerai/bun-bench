import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

let server: RunningServer | undefined;

function book(base: string, fail_at?: string) {
  return fetch(`${base}/book-trip`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fail_at ? { fail_at } : {}),
  });
}

describe("saga public", () => {
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

  test("successful trip completes all steps", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const res = await book(server.baseUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    const saga = await (
      await fetch(`${server.baseUrl}/sagas/${body.saga_id}`)
    ).json();
    expect(saga.state).toBe("completed");
    expect(
      saga.resources.flight && saga.resources.hotel && saga.resources.charge
    ).toBe(true);
  });
});
