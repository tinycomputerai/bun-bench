import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

function createSchedule(baseUrl: string, body: object) {
  return fetch(`${baseUrl}/schedules`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("dst recurrence public", () => {
  let server: RunningServer | undefined;

  beforeAll(async () => {
    server = await startTaskServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("daily schedule returns UTC occurrences", async () => {
    if (!server) {
      throw new Error("server did not start");
    }
    const created = await (
      await createSchedule(server.baseUrl, {
        id: "pub-daily",
        tz: "America/New_York",
        hour: 9,
        minute: 30,
        frequency: "daily",
      })
    ).json();
    const response = await fetch(
      `${server.baseUrl}/schedules/${created.id}/occurrences?from=2024-03-08T00:00:00Z&to=2024-03-10T00:00:00Z`
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.occurrences.length).toBe(2);
    expect(body.occurrences[0]).toBe("2024-03-08T14:30:00Z");
  });
});
