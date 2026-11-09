-- Add Memories and Tasks to an existing IrshadMCP database.
-- Safe to run repeatedly; public.db.sql contains the complete fresh-install schema.

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
