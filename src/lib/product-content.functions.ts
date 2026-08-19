import { createServerFn } from "@tanstack/react-start";

export const getProductPageContent = createServerFn({ method: "GET" })
  .validator((data: { dealId: string; title: string; category: string }) => data)
  .handler(async ({ data }) => {
    // Keep the Supabase service-role client and Gemini API code out of the
    // browser bundle. This function is the only product-page entry point.
    const { getOrGenerateProductContent } = await import("@/lib/product-content.server");
    return getOrGenerateProductContent(data.dealId, data.title, data.category);
  });
