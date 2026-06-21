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

describe("backpressure public", () => {
  beforeAll(async () => {
    server = await startTaskServer();
  });
  afterAll(async () => {
    for (const ws of sockets) {
      ws.close();
    }
    await server?.stop();
  });

  test("healthz", async () => {
    if (!server) {
      throw new Error("no server");
    }
    expect((await fetch(`${server.baseUrl}/healthz`)).status).toBe(200);
  });

  test("subscriber receives ordered seq", async () => {
    if (!server) {
      throw new Error("no server");
    }
    const topic = `pub-${Math.random().toString(36).slice(2)}`;
    const sub = await connect(wsUrl(server.baseUrl, topic));
    await publish(server.baseUrl, topic, { n: 1 });
    await publish(server.baseUrl, topic, { n: 2 });
    const m1 = await sub.next((m) => m.seq === 1);
    const m2 = await sub.next((m) => m.seq === 2);
    expect(m1.data).toEqual({ n: 1 });
    expect(m2.data).toEqual({ n: 2 });
    sub.ws.close();
  });
});
