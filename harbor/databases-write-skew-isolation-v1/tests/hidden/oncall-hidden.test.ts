import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

let server: RunningServer | undefined;

async function resetRoster(base: string) {
  await fetch(`${base}/oncall/eng-1/on`, { method: "POST" });
  await fetch(`${base}/oncall/eng-2/on`, { method: "POST" });
}

describe("write skew hidden", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    await server?.stop();
  });

  test("concurrent off requests leave one on call", async () => {
    if (!server) {
      throw new Error("no server");
    }
    await resetRoster(server.baseUrl);
    const [r1, r2] = await Promise.all([
      fetch(`${server.baseUrl}/oncall/eng-1/off`, { method: "POST" }),
      fetch(`${server.baseUrl}/oncall/eng-2/off`, { method: "POST" }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
    const roster = await (await fetch(`${server.baseUrl}/oncall`)).json();
    expect(roster.on_call.length).toBe(1);
  });

  test("cannot go off when last on call", async () => {
    if (!server) {
      throw new Error("no server");
    }
    await resetRoster(server.baseUrl);
    await fetch(`${server.baseUrl}/oncall/eng-1/off`, { method: "POST" });
    const res = await fetch(`${server.baseUrl}/oncall/eng-2/off`, {
      method: "POST",
    });
    expect(res.status).toBe(409);
  });
});
