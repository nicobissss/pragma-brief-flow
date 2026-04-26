ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.clients   ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_prospects_is_test ON public.prospects(is_test) WHERE is_test;
CREATE INDEX IF NOT EXISTS idx_clients_is_test   ON public.clients(is_test)   WHERE is_test;