import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startTaskServer, type RunningServer } from "../helpers/server";

async function createRecord(baseUrl: string, legacy_value: number) {
  return fetch(`${baseUrl}/records`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ legacy_value }),
  });
}

describe("online migration public", () => {
  let server: RunningServer | undefined;

  beforeAll(async () => {
    server = await startTaskServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("legacy read before migration", async () => {
    if (!server) throw new Error("server did not start");
    const row = await (await createRecord(server.baseUrl, 5)).json();
    expect(row.value).toBe(5);
  });

  test("dual write after migration start", async () => {
    if (!server) throw new Error("server did not start");
    const row = await (await createRecord(server.baseUrl, 4)).json();
    await fetch(`${server.baseUrl}/migration/start`, { method: "POST" });
    const patched = await fetch(`${server.baseUrl}/records/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ legacy_value: 7 }),
    });
    expect((await patched.json()).value).toBe(14);
  });
});
