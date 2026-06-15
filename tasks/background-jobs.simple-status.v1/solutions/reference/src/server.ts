const port = Number(Bun.env.PORT ?? 3000);
const jobs = new Map<string, { id: string; status: "completed" }>();

Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/jobs") {
      const job = { id: `job_${jobs.size + 1}`, status: "completed" as const };
      jobs.set(job.id, job);
      return Response.json(job, { status: 202 });
    }

    if (request.method === "GET" && url.pathname.startsWith("/jobs/")) {
      const id = url.pathname.slice("/jobs/".length);
      const job = jobs.get(id);
      if (!job) {
        return Response.json({ error: "not_found" }, { status: 404 });
      }
      return Response.json(job, { status: 200 });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
});

console.log(`reference server listening on ${port}`);
