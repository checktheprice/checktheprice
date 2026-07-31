-- Amazon PA API integration: additive only. No drops, no destructive changes.
-- Existing columns, rows, RLS policies and grants are left untouched.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS asin                     text,
  ADD COLUMN IF NOT EXISTS last_checked_at          timestamptz,
  ADD COLUMN IF NOT EXISTS last_amazon_payload_hash text;

CREATE INDEX IF NOT EXISTS deals_last_checked_at_idx
  ON public.deals (last_checked_at NULLS FIRST);

CREATE INDEX IF NOT EXISTS deals_asin_idx
  ON public.deals (asin) WHERE asin IS NOT NULL;
