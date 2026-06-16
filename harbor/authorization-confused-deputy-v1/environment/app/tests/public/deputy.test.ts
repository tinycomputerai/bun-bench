import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startTaskServer, type RunningServer } from "../helpers/server";

let server: RunningServer | undefined;

async function delegation(base: string, bearer: string, principal: string, scopes: string[]) {
  return fetch(`${base}/delegations`, {
    method: "POST",
    headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    body: JSON.stringify({ principal, scopes }),
  });
}

async function actAs(base: string, bearer: string, token: string, action: string, resource_id: string) {
  return fetch(`${base}/act-as`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bearer}`,
      "x-delegation-token": token,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action, resource_id }),
  });
}

describe("confused deputy public", () => {
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
    expect(await res.json()).toEqual({ ok: true });
  });

  test("editor deputy can read owned resource", async () => {
    if (!server) throw new Error("no server");
    const del = await delegation(server.baseUrl, "tok-editor", "editor", ["read"]);
    const { token } = await del.json();
    const res = await actAs(server.baseUrl, "tok-editor", token, "read", "res-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.acted_as).toBe("editor");
  });

  test("viewer cannot write even with write scope in token", async () => {
    if (!server) throw new Error("no server");
    const del = await delegation(server.baseUrl, "tok-viewer", "viewer", ["read", "write"]);
    const { token } = await del.json();
    const res = await actAs(server.baseUrl, "tok-viewer", token, "write", "res-1");
    expect(res.status).toBe(403);
  });
});
