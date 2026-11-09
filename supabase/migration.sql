-- Add account ownership and Memories and Tasks to an existing IrshadMCP database.
-- Safe to run repeatedly; public.db.sql contains the complete fresh-install schema.

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notes_user ON public.notes (user_id);
CREATE INDEX IF NOT EXISTS idx_skills_user ON public.skills (user_id);
CREATE INDEX IF NOT EXISTS idx_pages_user ON public.pages (user_id);

-- Existing private records have NULL user_id and remain inaccessible until claimed.
-- After Google login, use the user_id returned by GET /oauth/session to assign
-- your existing notes and skills, for example:
-- UPDATE public.notes SET user_id = 'google:<sub>' WHERE user_id IS NULL;
-- UPDATE public.skills SET user_id = 'google:<sub>' WHERE user_id IS NULL;
-- UPDATE public.pages SET user_id = 'google:<sub>' WHERE user_id IS NULL;
-- Existing published pages remain public, but only a signed-in owner can manage
-- pages that have an assigned user_id.

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

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.memories FROM anon, authenticated;
GRANT ALL ON public.memories TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tasks FROM anon, authenticated;
GRANT ALL ON public.tasks TO service_role;
