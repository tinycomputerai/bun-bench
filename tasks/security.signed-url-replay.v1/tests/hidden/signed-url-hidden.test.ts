import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

let server: RunningServer | undefined;

function sign(
  base: string,
  method: string,
  path: string,
  query?: Record<string, string>
) {
  return fetch(`${base}/sign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, path, query, ttl: 300 }),
  });
}

describe("signed url hidden", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    await server?.stop();
  });

  test("replay nonce rejected", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const signed = await (await sign(server.baseUrl, "GET", "/secret")).json();
    const url = `${server.baseUrl}${signed.url}`;
    expect((await fetch(url)).status).toBe(200);
    expect((await fetch(url)).status).toBe(403);
  });

  test("tampered query rejected", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const signed = await (
      await sign(server.baseUrl, "GET", "/secret", { a: "1" })
    ).json();
    const tampered = signed.url.replace("a=1", "a=2");
    expect((await fetch(`${server.baseUrl}${tampered}`)).status).toBe(403);
  });

  test("tampered path rejected", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const signed = await (await sign(server.baseUrl, "GET", "/secret")).json();
    const tampered = signed.url.replace("/secret", "/other");
    expect((await fetch(`${server.baseUrl}${tampered}`)).status).toBe(403);
  });

  test("expired url rejected", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const signed = await (
      await fetch(`${server.baseUrl}/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "GET", path: "/old", ttl: -120 }),
      })
    ).json();
    expect((await fetch(`${server.baseUrl}${signed.url}`)).status).toBe(403);
  });
});
