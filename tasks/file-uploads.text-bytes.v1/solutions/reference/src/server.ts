const port = Number(Bun.env.PORT ?? 3000);

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/upload") {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.split(";")[0].trim().toLowerCase() !== "text/plain") {
        return Response.json(
          { error: "unsupported_media_type" },
          { status: 415 }
        );
      }

      const bytes = (await request.arrayBuffer()).byteLength;
      return Response.json({ bytes }, { status: 200 });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
});

console.log(`reference server listening on ${port}`);
