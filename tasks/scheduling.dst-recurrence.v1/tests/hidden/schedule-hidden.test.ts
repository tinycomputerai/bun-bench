import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startTaskServer, type RunningServer } from "../helpers/server";

async function createSchedule(baseUrl: string, body: object) {
  return fetch(`${baseUrl}/schedules`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function occurrences(baseUrl: string, id: string, from: string, to: string) {
  return (
    await fetch(
      `${baseUrl}/schedules/${encodeURIComponent(id)}/occurrences?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    )
  ).json();
}

describe("dst recurrence hidden", () => {
  let server: RunningServer | undefined;

  beforeAll(async () => {
    server = await startTaskServer();
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("spring-forward day shifts UTC offset for 09:30", async () => {
    if (!server) throw new Error("server did not start");
    await createSchedule(server.baseUrl, {
      id: "hid-shift",
      tz: "America/New_York",
      hour: 9,
      minute: 30,
      frequency: "daily",
    });
    const body = await occurrences(
      server.baseUrl,
      "hid-shift",
      "2024-03-08T00:00:00Z",
      "2024-03-12T00:00:00Z",
    );
    const before = body.occurrences.find((o: string) => o.startsWith("2024-03-08"));
    const after = body.occurrences.find((o: string) => o.startsWith("2024-03-11"));
    expect(before).toBe("2024-03-08T14:30:00Z");
    expect(after).toBe("2024-03-11T13:30:00Z");
  });

  test("nonexistent local time on spring-forward gap day is skipped", async () => {
    if (!server) throw new Error("server did not start");
    await createSchedule(server.baseUrl, {
      id: "hid-gap",
      tz: "America/New_York",
      hour: 2,
      minute: 30,
      frequency: "daily",
    });
    const body = await occurrences(
      server.baseUrl,
      "hid-gap",
      "2024-03-09T00:00:00Z",
      "2024-03-11T00:00:00Z",
    );
    expect(body.occurrences.some((o: string) => o.startsWith("2024-03-10"))).toBe(false);
    expect(body.occurrences.some((o: string) => o.startsWith("2024-03-09"))).toBe(true);
  });

  test("fall-back ambiguous time emits a single earlier occurrence", async () => {
    if (!server) throw new Error("server did not start");
    await createSchedule(server.baseUrl, {
      id: "hid-overlap",
      tz: "America/New_York",
      hour: 1,
      minute: 30,
      frequency: "daily",
    });
    const body = await occurrences(
      server.baseUrl,
      "hid-overlap",
      "2024-11-03T00:00:00Z",
      "2024-11-04T00:00:00Z",
    );
    const nov3 = body.occurrences.filter((o: string) => o.startsWith("2024-11-03"));
    expect(nov3.length).toBe(1);
    expect(nov3[0]).toBe("2024-11-03T05:30:00Z");
  });
});
