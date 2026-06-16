import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startTaskServer, type RunningServer } from "../helpers/server";

async function createRecord(baseUrl: string, legacy_value: number) {
  return fetch(`${baseUrl}/records`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ legacy_value }),
  });
}

async function backfillAll(baseUrl: string) {
  for (let i = 0; i < 20; i += 1) {
    const result = await (
      await fetch(`${baseUrl}/migration/backfill?batch=10`, { method: "POST" })
    ).json();
    if (result.backfill_complete) return result;
  }
  throw new Error("backfill did not complete");
}

async function resetMigration(baseUrl: string) {
  const status = await (await fetch(`${baseUrl}/migration/status`)).json();
  if (status.phase !== "legacy_only" && status.phase !== "rolled_back") {
    await fetch(`${baseUrl}/migration/rollback`, { method: "POST" });
  }
}

describe("online migration hidden", () => {
  let server: RunningServer | undefined;

  beforeAll(async () => {
    server = await startTaskServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("backfill is resumable and cutover gated", async () => {
    if (!server) throw new Error("server did not start");
    await resetMigration(server.baseUrl);
    await createRecord(server.baseUrl, 1);
    await createRecord(server.baseUrl, 2);
    await fetch(`${server.baseUrl}/migration/start`, { method: "POST" });

    const blocked = await fetch(`${server.baseUrl}/migration/cutover`, { method: "POST" });
    expect(blocked.status).toBe(409);

    await backfillAll(server.baseUrl);
    const cutover = await fetch(`${server.baseUrl}/migration/cutover`, { method: "POST" });
    expect(cutover.status).toBe(200);
    expect((await (await fetch(`${server.baseUrl}/migration/status`)).json()).phase).toBe("cutover");
  });

  test("concurrent write during backfill is not clobbered", async () => {
    if (!server) throw new Error("server did not start");
    await resetMigration(server.baseUrl);
    const row = await (await createRecord(server.baseUrl, 3)).json();
    await fetch(`${server.baseUrl}/migration/start`, { method: "POST" });
    await fetch(`${server.baseUrl}/migration/backfill?batch=1`, { method: "POST" });
    await fetch(`${server.baseUrl}/records/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ legacy_value: 9 }),
    });
    await backfillAll(server.baseUrl);
    const read = await (await fetch(`${server.baseUrl}/records/${row.id}`)).json();
    expect(read.normalized_value).toBe(18);
  });

  test("rollback returns to legacy reads", async () => {
    if (!server) throw new Error("server did not start");
    await resetMigration(server.baseUrl);
    const row = await (await createRecord(server.baseUrl, 6)).json();
    await fetch(`${server.baseUrl}/migration/start`, { method: "POST" });
    await fetch(`${server.baseUrl}/migration/rollback`, { method: "POST" });
    const read = await (await fetch(`${server.baseUrl}/records/${row.id}`)).json();
    expect(read.value).toBe(6);
    expect(read.normalized_value).toBeNull();
  });
});
