import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const PROMETHEUS_URL =
  "https://www.firecrawl.dev/prometheus/api/v1/scripts/30D4teMBEGmVlYVCW41uq/run";

type PrometheusProductDetails = {
  standard_link?: unknown;
  title?: unknown;
  category?: unknown;
  price?: unknown;
  mrp?: unknown;
  image?: unknown;
  updated?: unknown;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toStringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function getProductDetails(body: unknown): PrometheusProductDetails {
  if (!body || typeof body !== "object") return {};
  const root = body as Record<string, unknown>;
  const candidates = [
    root,
    root.data,
    root.result,
    root.output,
    root.json,
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>).json
      : undefined,
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>).output
      : undefined,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      const details = candidate as PrometheusProductDetails;
      if (details.title || details.price || details.image) return details;
    }
  }

  return {};
}

export const Route = createFileRoute("/api/admin/fetch-details")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) {
          return jsonResponse({ error: "FIRECRAWL_API_KEY is not configured." }, 500);
        }

        const requestBody = await request.json().catch(() => null);
        const url =
          requestBody && typeof requestBody === "object"
            ? String((requestBody as Record<string, unknown>).url ?? "").trim()
            : "";

        if (!url) {
          return jsonResponse({ error: "Amazon product URL is required." }, 400);
        }

        console.log("PROMETHEUS API CALLED");
        const response = await fetch(PROMETHEUS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            params: { url },
          }),
        });
        console.log("Prometheus HTTP status:", response.status);

        const responseText = await response.text();
        console.log("Prometheus response:", responseText);

        let body: unknown = null;
        try {
          body = JSON.parse(responseText);
        } catch {
          body = null;
        }

        if (!response.ok) {
          return jsonResponse(
            {
              error:
                (body &&
                  typeof body === "object" &&
                  ((body as Record<string, unknown>).error ||
                    (body as Record<string, unknown>).message)) ||
                `Prometheus HTTP ${response.status}`,
            },
            response.status,
          );
        }

        const details = getProductDetails(body);
        const product = {
          standard_link: toStringValue(details.standard_link) || url,
          title: toStringValue(details.title),
          category: toStringValue(details.category),
          price: toStringValue(details.price),
          mrp: toStringValue(details.mrp),
          image: toStringValue(details.image),
          updated: toStringValue(details.updated),
        };

        if (!product.title || !product.price || !product.image) {
          return jsonResponse({ error: "Prometheus returned incomplete product details." }, 502);
        }

        return jsonResponse(product);
      },
    },
  },
});
