import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

let server: RunningServer | undefined;

function delegation(
  base: string,
  bearer: string,
  principal: string,
  scopes: string[],
  chain?: string[]
) {
  return fetch(`${base}/delegations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bearer}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ principal, scopes, chain }),
  });
}

function actAs(
  base: string,
  bearer: string,
  token: string,
  action: string,
  resource_id: string
) {
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

describe("confused deputy hidden", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    await server?.stop();
  });

  test("admin deputy cannot escalate viewer to write", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const del = await delegation(server.baseUrl, "tok-admin", "viewer", [
      "read",
      "write",
    ]);
    const { token } = await del.json();
    const res = await actAs(
      server.baseUrl,
      "tok-admin",
      token,
      "write",
      "res-1"
    );
    expect(res.status).toBe(403);
  });

  test("delegation chain narrows scopes", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const del = await delegation(
      server.baseUrl,
      "tok-admin",
      "editor",
      ["read", "write", "admin"],
      ["viewer"]
    );
    const { token } = await del.json();
    const res = await actAs(
      server.baseUrl,
      "tok-admin",
      token,
      "write",
      "res-1"
    );
    expect(res.status).toBe(403);
    const read = await actAs(
      server.baseUrl,
      "tok-admin",
      token,
      "read",
      "res-1"
    );
    expect(read.status).toBe(200);
  });

  test("revoked delegation is rejected", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const del = await delegation(server.baseUrl, "tok-editor", "editor", [
      "read",
      "write",
    ]);
    const body = await del.json();
    await fetch(`${server.baseUrl}/delegations/${body.id}/revoke`, {
      method: "POST",
      headers: { authorization: "Bearer tok-editor" },
    });
    const res = await actAs(
      server.baseUrl,
      "tok-editor",
      body.token,
      "read",
      "res-1"
    );
    expect(res.status).toBe(403);
  });

  test("audit logs deputy and principal", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const del = await delegation(server.baseUrl, "tok-editor", "editor", [
      "read",
    ]);
    const { token } = await del.json();
    await actAs(server.baseUrl, "tok-editor", token, "read", "res-1");
    const audit = await (await fetch(`${server.baseUrl}/audit`)).json();
    const last = audit.entries.at(-1);
    expect(last.deputy).toBe("editor");
    expect(last.principal).toBe("editor");
    expect(last.allowed).toBe(true);
  });
});
