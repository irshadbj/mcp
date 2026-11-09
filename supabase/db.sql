-- Postgres (Supabase) version of the IrshadMCP schema (fresh install).
-- For an existing database, run supabase/migration.sql to add Memories and Tasks.

CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_updated_at
ON public.notes (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_user
ON public.notes (user_id);

-- Reusable skills (how-to guides), separate from notes.
CREATE TABLE IF NOT EXISTS public.skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_updated_at
ON public.skills (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_skills_user
ON public.skills (user_id);

-- Public pages published through the MCP publish_page tool.
-- content holds the page body. The column is deliberately NOT named "html":
-- it may hold HTML, plain text or another data type.
-- booklet groups pages into a booklet on the /pages shelf.
CREATE TABLE IF NOT EXISTS public.pages (
  slug TEXT PRIMARY KEY,
  user_id TEXT,
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

CREATE INDEX IF NOT EXISTS idx_pages_user
ON public.pages (user_id);

-- Memory records used for user-specific context.
CREATE TABLE IF NOT EXISTS public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memories_user
ON public.memories (user_id);

CREATE INDEX IF NOT EXISTS idx_memories_tags
ON public.memories USING GIN (tags);

-- User task list.
CREATE TABLE IF NOT EXISTS public.tasks (
  task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user
ON public.tasks (user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
ON public.tasks (due_date);

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

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.memories FROM anon, authenticated;
GRANT ALL ON public.memories TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tasks FROM anon, authenticated;
GRANT ALL ON public.tasks TO service_role;
