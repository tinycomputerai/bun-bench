import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

let server: RunningServer | undefined;

function book(base: string, fail_at?: string) {
  return fetch(`${base}/book-trip`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fail_at }),
  });
}

describe("saga hidden", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    await server?.stop();
  });

  test("charge failure compensates prior steps", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const res = await book(server.baseUrl, "charge_card");
    expect(res.status).toBe(409);
    const { saga_id } = await res.json();
    const saga = await (
      await fetch(`${server.baseUrl}/sagas/${saga_id}`)
    ).json();
    expect(saga.state).toBe("failed");
    expect(saga.resources.flight).toBe(false);
    expect(saga.resources.hotel).toBe(false);
    expect(saga.resources.charge).toBe(false);
    const compensated = saga.steps.filter(
      (s: { status: string }) => s.status === "compensated"
    );
    expect(compensated.length).toBe(2);
  });

  test("hotel failure compensates flight only", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const res = await book(server.baseUrl, "reserve_hotel");
    const { saga_id } = await res.json();
    const saga = await (
      await fetch(`${server.baseUrl}/sagas/${saga_id}`)
    ).json();
    expect(saga.resources.flight).toBe(false);
    expect(saga.resources.hotel).toBe(false);
    expect(saga.resources.charge).toBe(false);
  });

  test("partial saga never reported completed", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const res = await book(server.baseUrl, "charge_card");
    const { saga_id } = await res.json();
    const saga = await (
      await fetch(`${server.baseUrl}/sagas/${saga_id}`)
    ).json();
    expect(saga.state).not.toBe("completed");
  });
});
