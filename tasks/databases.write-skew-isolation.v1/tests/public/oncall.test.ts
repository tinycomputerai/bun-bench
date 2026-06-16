import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startTaskServer, type RunningServer } from "../helpers/server";

let server: RunningServer | undefined;

describe("write skew public", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    await server?.stop();
  });

  test("healthz", async () => {
    if (!server) throw new Error("no server");
    const res = await fetch(`${server.baseUrl}/healthz`);
    expect(res.status).toBe(200);
  });

  test("two engineers start on call", async () => {
    if (!server) throw new Error("no server");
    const res = await (await fetch(`${server.baseUrl}/oncall`)).json();
    expect(res.on_call.sort()).toEqual(["eng-1", "eng-2"]);
  });

  test("single off succeeds when two on call", async () => {
    if (!server) throw new Error("no server");
    const res = await fetch(`${server.baseUrl}/oncall/eng-1/off`, { method: "POST" });
    expect(res.status).toBe(200);
    const roster = await (await fetch(`${server.baseUrl}/oncall`)).json();
    expect(roster.on_call).toEqual(["eng-2"]);
  });
});
