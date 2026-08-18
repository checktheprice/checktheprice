import { createServerFn } from "@tanstack/react-start";
import { getOrGenerateProductContent } from "@/lib/product-content.server";

export const getProductPageContent = createServerFn({ method: "GET" })
  .validator((data: { dealId: string; title: string; category: string }) => data)
  .handler(async ({ data }) => {
    return getOrGenerateProductContent(data.dealId, data.title, data.category);
  });
