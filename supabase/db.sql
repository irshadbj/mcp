-- Postgres (Supabase) version of the IrshadMCP schema (fresh install).
-- For an existing database, run supabase/migration.sql instead: it also
-- inspects columns under already-existing tables, re-adds deleted columns
-- and adds the new columns this release needs.

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

-- Reusable skills (how-to guides), separate from notes.
CREATE TABLE IF NOT EXISTS public.skills (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_updated_at
ON public.skills (updated_at DESC);

-- Public pages published through the MCP publish_page tool.
-- content holds the page body. The column is deliberately NOT named "html":
-- it may hold HTML, plain text or another data type.
-- booklet groups pages into a booklet on the /pages shelf.
CREATE TABLE IF NOT EXISTS public.pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  booklet TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pages_updated_at
ON public.pages (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pages_booklet
ON public.pages (booklet);

-- Only the server (service role) may touch these tables.
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notes FROM anon, authenticated;
GRANT ALL ON public.notes TO service_role;

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.skills FROM anon, authenticated;
GRANT ALL ON public.skills TO service_role;

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pages FROM anon, authenticated;
GRANT ALL ON public.pages TO service_role;
