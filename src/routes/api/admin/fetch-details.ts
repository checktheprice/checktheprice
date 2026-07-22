import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/fetch-details")({
  server: {
    handlers: {
      POST: async () => {
        // The previous Prometheus /run integration has been removed.
        // Replace this endpoint with a new scraping service to restore
        // the Fetch Product functionality.
        return jsonResponse(
          {
            error:
              "The Prometheus scraping integration has been removed. Please configure a replacement scraping service.",
          },
          410,
        );
      },
    },
  },
});
