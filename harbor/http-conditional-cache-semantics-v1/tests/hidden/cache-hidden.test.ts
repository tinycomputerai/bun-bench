import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

describe("conditional cache hidden", () => {
  let server: RunningServer | undefined;
  const identityHeaders = { "accept-encoding": "identity" };

  beforeAll(async () => {
    server = await startTaskServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("If-Modified-Since match returns 304", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const first = await fetch(`${server.baseUrl}/resource`, {
      headers: identityHeaders,
    });
    const lastModified = first.headers.get("last-modified");
    const second = await fetch(`${server.baseUrl}/resource`, {
      headers: { ...identityHeaders, "if-modified-since": lastModified ?? "" },
    });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  test("ETag takes precedence over If-Modified-Since", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const first = await fetch(`${server.baseUrl}/resource`, {
      headers: identityHeaders,
    });
    const etag = first.headers.get("etag");
    const staleSince = new Date(Date.now() + 86_400_000).toUTCString();
    const response = await fetch(`${server.baseUrl}/resource`, {
      headers: {
        ...identityHeaders,
        "if-none-match": etag ?? "",
        "if-modified-since": staleSince,
      },
    });
    expect(response.status).toBe(304);
  });

  test("PUT requires strong If-Match", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const current = await fetch(`${server.baseUrl}/resource`, {
      headers: identityHeaders,
    });
    const etag = current.headers.get("etag");
    const bad = await fetch(`${server.baseUrl}/resource`, {
      method: "PUT",
      headers: {
        "if-match": `W/${etag ?? ""}`,
        "accept-encoding": "identity",
      },
      body: "next",
    });
    expect(bad.status).toBe(412);

    const ok = await fetch(`${server.baseUrl}/resource`, {
      method: "PUT",
      headers: { "if-match": etag ?? "", "accept-encoding": "identity" },
      body: "next",
    });
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("next");
  });

  test("cached endpoint respects Vary by encoding", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const identity = await fetch(`${server.baseUrl}/cached/resource`, {
      headers: identityHeaders,
    });
    const gzip = await fetch(`${server.baseUrl}/cached/resource`, {
      headers: { "accept-encoding": "gzip" },
    });
    expect(identity.headers.get("x-cache")).toBe("HIT");
    expect(gzip.headers.get("x-cache")).toBe("HIT");
    expect(await identity.text()).toBe("next");
    expect(await gzip.text()).toStartWith("gzip:");
  });

  test("cached conditional If-None-Match returns 304", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const first = await fetch(`${server.baseUrl}/cached/resource`, {
      headers: identityHeaders,
    });
    const etag = first.headers.get("etag");
    const second = await fetch(`${server.baseUrl}/cached/resource`, {
      headers: { ...identityHeaders, "if-none-match": etag ?? "" },
    });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });
});
