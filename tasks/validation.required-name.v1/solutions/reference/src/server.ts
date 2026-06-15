const port = Number(Bun.env.PORT ?? 3000);

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/users") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid_name" }, { status: 422 });
      }

      const name = typeof body === "object" && body !== null && "name" in body ? body.name : undefined;
      if (typeof name !== "string" || name.trim().length === 0) {
        return Response.json({ error: "invalid_name" }, { status: 422 });
      }

      return Response.json({ id: "user_1", name }, { status: 201 });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
});

console.log(`reference server listening on ${port}`);
