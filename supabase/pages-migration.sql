-- Run this in the Supabase SQL Editor.
-- Published pages are stored separately from private notes in public.pages.
CREATE TABLE IF NOT EXISTS public.pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  html TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pages_updated_at
ON public.pages (updated_at DESC);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pages FROM anon, authenticated;
GRANT ALL ON public.pages TO service_role;
