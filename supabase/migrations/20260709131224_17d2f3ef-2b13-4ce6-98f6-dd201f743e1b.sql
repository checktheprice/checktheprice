
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Deals table (website-published deals; independent of Google Sheet)
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  price NUMERIC(12,2) NOT NULL,
  mrp NUMERIC(12,2) NOT NULL,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'Amazon',
  standard_link TEXT,
  affiliate_link TEXT NOT NULL,
  coupon_code TEXT,
  hot_deal BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX deals_active_updated_idx ON public.deals (is_active, updated_at DESC);
CREATE INDEX deals_category_idx ON public.deals (category);

GRANT SELECT ON public.deals TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active deals" ON public.deals
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can view all deals" ON public.deals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert deals" ON public.deals
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update deals" ON public.deals
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete deals" ON public.deals
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER deals_set_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Future-ready: price history table
CREATE TABLE public.deal_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL,
  mrp NUMERIC(12,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX deal_price_history_deal_time_idx ON public.deal_price_history (deal_id, recorded_at DESC);

GRANT SELECT ON public.deal_price_history TO anon, authenticated;
GRANT INSERT ON public.deal_price_history TO authenticated;
GRANT ALL ON public.deal_price_history TO service_role;
ALTER TABLE public.deal_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view price history" ON public.deal_price_history FOR SELECT USING (true);
CREATE POLICY "Admins can insert price history" ON public.deal_price_history
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Snapshot initial price when a deal is inserted
CREATE OR REPLACE FUNCTION public.snapshot_deal_price()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.deal_price_history (deal_id, price, mrp)
  VALUES (NEW.id, NEW.price, NEW.mrp);
  RETURN NEW;
END; $$;

CREATE TRIGGER deals_snapshot_on_insert AFTER INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_deal_price();

CREATE OR REPLACE FUNCTION public.snapshot_deal_price_on_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.price IS DISTINCT FROM OLD.price OR NEW.mrp IS DISTINCT FROM OLD.mrp THEN
    INSERT INTO public.deal_price_history (deal_id, price, mrp)
    VALUES (NEW.id, NEW.price, NEW.mrp);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER deals_snapshot_on_update AFTER UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_deal_price_on_change();
