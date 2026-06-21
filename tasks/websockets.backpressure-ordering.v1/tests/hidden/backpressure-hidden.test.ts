import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type RunningServer, startTaskServer } from "../helpers/server";

let server: RunningServer | undefined;
const sockets: WebSocket[] = [];

function wsUrl(base: string, topic: string): string {
  return `${base.replace("http", "ws")}/ws?topic=${encodeURIComponent(topic)}`;
}

interface Recorder {
  next: (pred: (m: any) => boolean, ms?: number) => Promise<any>;
  ws: WebSocket;
}

function connect(url: string): Promise<Recorder> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    sockets.push(ws);
    const buffer: any[] = [];
    let waiter: {
      predicate: (m: any) => boolean;
      resolve: (m: any) => void;
    } | null = null;
    ws.addEventListener("message", (event: MessageEvent) => {
      let parsed: any;
      try {
        parsed = JSON.parse(
          typeof event.data === "string" ? event.data : String(event.data)
        );
      } catch {
        return;
      }
      if (waiter?.predicate(parsed)) {
        const w = waiter;
        waiter = null;
        w.resolve(parsed);
        return;
      }
      buffer.push(parsed);
    });
    const t = setTimeout(() => reject(new Error("ws timeout")), 4000);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      resolve({
        ws,
        next(predicate, ms = 4000) {
          const idx = buffer.findIndex(predicate);
          if (idx >= 0) {
            return Promise.resolve(buffer.splice(idx, 1)[0]);
          }
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              waiter = null;
              rej(new Error("next timeout"));
            }, ms);
            waiter = {
              predicate,
              resolve: (m) => {
                clearTimeout(timer);
                res(m);
              },
            };
          });
        },
      });
    });
    ws.addEventListener("error", () => reject(new Error("ws error")));
  });
}

function publish(base: string, topic: string, data: unknown) {
  return fetch(`${base}/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic, data }),
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe("backpressure hidden", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    for (const ws of sockets) {
      ws.close();
    }
    await server?.stop();
  });

  test("slow consumer gets gap marker under flood", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const topic = `hid-gap-${Math.random().toString(36).slice(2)}`;
    const slow = await connect(wsUrl(server.baseUrl, topic));
    for (let i = 1; i <= 20; i += 1) {
      await publish(server.baseUrl, topic, { i });
    }
    await sleep(200);
    let sawGap = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const msg = await slow.next(() => true, 200);
        if (msg.type === "gap") {
          sawGap = true;
        }
      } catch {
        break;
      }
    }
    expect(sawGap).toBe(true);
    slow.ws.close();
  }, 15_000);

  test("fast client not blocked by slow client", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const topic = `hid-hol-${Math.random().toString(36).slice(2)}`;
    const slow = await connect(wsUrl(server.baseUrl, topic));
    const fast = await connect(wsUrl(server.baseUrl, topic));
    for (let i = 1; i <= 15; i += 1) {
      await publish(server.baseUrl, topic, { i });
    }
    const msg = await fast.next((m) => m.seq === 1, 2000);
    expect(msg.data).toEqual({ i: 1 });
    slow.ws.close();
    fast.ws.close();
  }, 10_000);
});
