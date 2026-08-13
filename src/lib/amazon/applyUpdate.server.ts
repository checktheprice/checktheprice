// Smart, non-destructive sync of Amazon Creators API data into the existing
// `deals` / `deal_price_history` tables. Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { getItems } from "./getItems";
import { extractAsin, type NormalizedProduct } from "./normalize";
import { payloadHash } from "./client";

t