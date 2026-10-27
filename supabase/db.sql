-- Postgres (Supabase) version of the notes schema
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_updated_at
ON public.notes (updated_at DESC);

-- Only the server (service role) may touch this table.
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notes FROM anon, authenticated;

-- Public HTML pages published through the MCP publish_page tool.
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