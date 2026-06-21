const port = Number(Bun.env.PORT ?? 3000);

Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/request-id") {
      const requestId = request.headers.get("x-request-id");
      if (!requestId) {
        return Response.json({ error: "bad_request" }, { status: 400 });
      }

      return Response.json(
        { requestId },
        { status: 200, headers: { "x-request-id": requestId } }
      );
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
});

console.log(`reference server listening on ${port}`);
