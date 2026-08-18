ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS ai_product_content jsonb;

COMMENT ON COLUMN public.deals.ai_product_content IS
  'Validated Gemini-generated product-page content derived from the product data; generated once and reused until explicitly regenerated.';
