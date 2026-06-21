const port = Number(Bun.env.PORT ?? 3000);

interface Engineer {
  id: string;
  on_call: boolean;
}

const engineers = new Map<string, Engineer>([
  ["eng-1", { id: "eng-1", on_call: true }],
  ["eng-2", { id: "eng-2", on_call: true }],
]);

const locks = new Map<string, Promise<void>>();

const OFF_RE = /^\/oncall\/([^/]+)\/off$/;
const ON_RE = /^\/oncall\/([^/]+)\/on$/;

async function withOncallLocks<T>(fn: () => T | Promise<T>): Promise<T> {
  const ids = [...engineers.keys()].sort();
  const releases: Array<() => void> = [];
  for (const id of ids) {
    const prev = locks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    locks.set(
      id,
      prev.then(() => gate)
    );
    await prev;
    releases.push(release);
  }
  try {
    return await fn();
  } finally {
    for (const release of releases.reverse()) {
      release();
    }
  }
}

Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return Response.json({ ok: true }, { status: 200 });
    }

    if (request.method === "GET" && url.pathname === "/oncall") {
      const onCall = [...engineers.values()]
        .filter((e) => e.on_call)
        .map((e) => e.id);
      return Response.json({ on_call: onCall }, { status: 200 });
    }

    const offMatch = OFF_RE.exec(url.pathname);
    if (request.method === "POST" && offMatch) {
      const id = decodeURIComponent(offMatch[1] as string);
      const engineer = engineers.get(id);
      if (!engineer) {
        return Response.json({ error: "not_found" }, { status: 404 });
      }

      return withOncallLocks(() => {
        if (!engineer.on_call) {
          return Response.json({ error: "already_off" }, { status: 409 });
        }
        const onCallCount = [...engineers.values()].filter(
          (e) => e.on_call
        ).length;
        if (onCallCount <= 1) {
          return Response.json(
            { error: "invariant_violation" },
            { status: 409 }
          );
        }
        engineer.on_call = false;
        return Response.json({ id, on_call: false }, { status: 200 });
      });
    }

    const onMatch = ON_RE.exec(url.pathname);
    if (request.method === "POST" && onMatch) {
      const id = decodeURIComponent(onMatch[1] as string);
      const engineer = engineers.get(id);
      if (!engineer) {
        return Response.json({ error: "not_found" }, { status: 404 });
      }
      return withOncallLocks(() => {
        engineer.on_call = true;
        return Response.json({ id, on_call: true }, { status: 200 });
      });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
});

console.log(`write-skew reference listening on ${port}`);
