import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

const ETAG_QUOTED = /^"/;

describe("conditional cache public", () => {
  let server: RunningServer | undefined;
  const identityHeaders = { "accept-encoding": "identity" };

  beforeAll(async () => {
    server = await startTaskServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("GET /resource returns validators and body", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const response = await fetch(`${server.baseUrl}/resource`, {
      headers: identityHeaders,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toMatch(ETAG_QUOTED);
    expect(response.headers.get("last-modified")).toBeTruthy();
    expect(response.headers.get("vary")).toBe("Accept-Encoding");
    expect(await response.text()).toBe("hello");
  });

  test("If-None-Match match returns 304 without body", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const first = await fetch(`${server.baseUrl}/resource`, {
      headers: identityHeaders,
    });
    const etag = first.headers.get("etag");
    const second = await fetch(`${server.baseUrl}/resource`, {
      headers: { ...identityHeaders, "if-none-match": etag ?? "" },
    });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  test("gzip and identity variants differ", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const identity = await (
      await fetch(`${server.baseUrl}/resource`, { headers: identityHeaders })
    ).text();
    const gzip = await (
      await fetch(`${server.baseUrl}/resource`, {
        headers: { "accept-encoding": "gzip" },
      })
    ).text();
    expect(gzip).toStartWith("gzip:");
    expect(identity).not.toStartWith("gzip:");
  });
});
