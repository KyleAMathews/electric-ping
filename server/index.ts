import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { Resource } from "sst";
import { neon } from "@neondatabase/serverless";

// Validation schemas
const pingSchema = z.object({
  ping_id: z.string(),
  client_start_time: z.string(),
});

const pingResultsSchema = z.object({
  ping_id: z.string(),
  client_start_time: z.string(),
  request_sent_at: z.number(),
  response_received_at: z.number(),
  pg_time_offset: z.number(),
  electric_arrive_offset: z.number(),
  client_end_offset: z.number(),
});

// Create the main app
const app = new Hono();

// Add CORS middleware
app.use("*", cors());

async function proxyToElectric(request, table) {
  const originUrl = new URL(`${Resource.ElectricUrl.url}v1/shape`);

  const url = new URL(request.url);
  url.searchParams.forEach((value, key) => {
    originUrl.searchParams.set(key, value);
  });

  originUrl.searchParams.set(`token`, Resource.electricInfo.token);
  originUrl.searchParams.set(`database_id`, Resource.electricInfo.database_id);

  originUrl.searchParams.set(`table`, table);

  // Create a copy of the original headers to include in the fetch to the upstream.
  const requestClone = new Request(request);
  const headersClone = new Headers(requestClone.headers);

  console.log(`Fetching shape from Admin Electric: ${originUrl.toString()}`);

  const response = await fetch(originUrl.toString(), {
    headers: headersClone,
    cf: { cacheEverything: true },
  });

  return response;
}

// Shape proxy endpoints
app.get("/shape-proxy/ping", async (c) => {
  console.log(`hi`)
  return proxyToElectric(c.req.raw, "ping");
});


// Start ping
app.post("/v1/ping", zValidator("json", pingSchema), async (c) => {
  try {
    const { ping_id, client_start_time } = c.req.valid("json");

    // Measure database insert time
    const startTime = performance.now();

    const sql = neon(Resource.databaseUriLink.pooledUrl);
    await sql`
      INSERT INTO ping (id, client_start_time)
      VALUES (${ping_id}, ${client_start_time})
    `;
    const db_insert_time = performance.now() - startTime;

    return c.json({ db_insert_time }, 200);
  } catch (error) {
    console.error("Error saving ping:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      400,
    );
  }
});

// Record ping result
app.post(
  "/v1/ping-result",
  zValidator("json", pingResultsSchema),
  async (c) => {
    try {
      const pingResult = c.req.valid("json");

      // Measure database insert time
      const startTime = performance.now();
      const sql = neon(Resource.databaseUriLink.pooledUrl);
      await sql`
        INSERT INTO ping_results (
          ping_id,
          client_start_time,
          request_sent_at,
          response_received_at,
          pg_time_offset,
          electric_arrive_offset,
          client_end_offset
        )
        VALUES (
          ${pingResult.ping_id},
          ${pingResult.client_start_time},
          ${pingResult.request_sent_at},
          ${pingResult.response_received_at},
          ${pingResult.pg_time_offset},
          ${pingResult.electric_arrive_offset},
          ${pingResult.client_end_offset}
        )
      `;
      const db_insert_time = performance.now() - startTime;

      return c.json({ db_insert_time }, 201);
    } catch (error) {
      console.error("Error recording ping result:", error);
      return c.json({ error: "Failed to record ping result" }, 400);
    }
  },
);

export default app;
