-- ============================================================
-- IrshadMCP — idempotent database update script
-- Run this in the Supabase SQL Editor. Safe to run repeatedly.
--
-- Unlike a plain CREATE TABLE IF NOT EXISTS, this script:
--   1. creates public.notes / public.pages / public.skills when missing,
--   2. inspects information_schema.columns under EVERY existing table and
--      re-adds each expected column that is missing (dropped/deleted),
--   3. adds the new columns this release needs (pages.content,
--      pages.booklet and the whole skills table),
--   4. repairs the earlier content -> html rename by copying html back
--      into content — nothing is renamed or dropped here,
--   5. restores primary keys, defaults, NOT NULL, indexes, RLS and grants.
-- ============================================================

-- 1) Tables (full definitions for brand-new databases) ----------------

CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  booklet TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.skills (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Column audit: re-add any expected column that is missing ----------
-- For each table the script checks information_schema.columns and adds a
-- deleted/absent column back, then reports every column currently present.

DO $$
DECLARE
  item TEXT[];
  tbl TEXT;
  col TEXT;
  ddl TEXT;
  r RECORD;
  expected CONSTANT TEXT[][] := ARRAY[
    ['notes',    'id',         'TEXT'],
    ['notes',    'title',      'TEXT'],
    ['notes',    'content',    'TEXT'],
    ['notes',    'tags',       'TEXT'],
    ['notes',    'created_at', 'TIMESTAMPTZ'],
    ['notes',    'updated_at', 'TIMESTAMPTZ'],
    ['pages',    'slug',       'TEXT'],
    ['pages',    'title',      'TEXT'],
    ['pages',    'content',    'TEXT'],
    ['pages',    'booklet',    'TEXT'],
    ['pages',    'created_at', 'TIMESTAMPTZ'],
    ['pages',    'updated_at', 'TIMESTAMPTZ'],
    ['skills',   'id',         'TEXT'],
    ['skills',   'title',      'TEXT'],
    ['skills',   'content',    'TEXT'],
    ['skills',   'tags',       'TEXT'],
    ['skills',   'created_at', 'TIMESTAMPTZ'],
    ['skills',   'updated_at', 'TIMESTAMPTZ']
  ];
BEGIN
  FOREACH item IN ARRAY expected LOOP
    tbl := item[1];
    col := item[2];
    ddl := item[3];

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = tbl
        AND c.column_name = col
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', tbl, col, ddl);
      RAISE NOTICE 'RE-ADDED missing/deleted column public.% (%)', tbl || '.' || col, ddl;
    END IF;
  END LOOP;

  -- Report the columns each table currently has, for the audit log.
  FOR r IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name IN ('notes', 'pages', 'skills')
    ORDER BY c.table_name, c.ordinal_position
  LOOP
    RAISE NOTICE 'column public.% (%) %', r.table_name, r.column_name, r.data_type;
  END LOOP;
END $$;

-- 3) Repair the earlier content -> html rename -------------------------
-- The app reads and writes pages.content. If an html column exists (from an
-- earlier rename), copy its values into content where content is empty.
-- The html column is left in place; drop it manually only after checking:
--   -- ALTER TABLE public.pages DROP COLUMN html;

DO $$
BEGIN
  IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pages' AND column_name = 'html'
     )
     AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pages' AND column_name = 'content'
     ) THEN
    UPDATE public.pages
       SET content = html
     WHERE (content IS NULL OR content = '')
       AND html IS NOT NULL;
    RAISE NOTICE 'copied legacy pages.html values into pages.content';
  END IF;
END $$;

-- 4) Restore primary keys if a constraint was dropped ------------------

DO $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES ('notes', 'id'), ('pages', 'slug'), ('skills', 'id')) AS t(tbl, pk)
  LOOP
    IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = m.tbl AND column_name = m.pk
       )
       AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relname = m.tbl
            AND c.contype = 'p'
       ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (%I)', m.tbl, m.pk);
        RAISE NOTICE 'restored primary key on public.% (%)', m.tbl, m.pk;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'could not restore primary key on public.% (%): %', m.tbl, m.pk, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- 5) Backfill any NULLs created by re-adding columns (no-ops when clean) -

UPDATE public.notes  SET title = ''      WHERE title IS NULL;
UPDATE public.notes  SET content = ''    WHERE content IS NULL;
UPDATE public.notes  SET tags = '[]'     WHERE tags IS NULL;
UPDATE public.notes  SET created_at = now() WHERE created_at IS NULL;
UPDATE public.notes  SET updated_at = now() WHERE updated_at IS NULL;

UPDATE public.pages  SET title = ''      WHERE title IS NULL;
UPDATE public.pages  SET content = ''    WHERE content IS NULL;
UPDATE public.pages  SET booklet = ''    WHERE booklet IS NULL;
UPDATE public.pages  SET created_at = now() WHERE created_at IS NULL;
UPDATE public.pages  SET updated_at = now() WHERE updated_at IS NULL;

UPDATE public.skills SET title = ''      WHERE title IS NULL;
UPDATE public.skills SET content = ''    WHERE content IS NULL;
UPDATE public.skills SET tags = '[]'     WHERE tags IS NULL;
UPDATE public.skills SET created_at = now() WHERE created_at IS NULL;
UPDATE public.skills SET updated_at = now() WHERE updated_at IS NULL;

-- 6) Constraints and defaults (idempotent) -----------------------------

ALTER TABLE public.notes ALTER COLUMN title SET NOT NULL;
ALTER TABLE public.notes ALTER COLUMN content SET NOT NULL;
ALTER TABLE public.notes ALTER COLUMN tags SET DEFAULT '[]';
ALTER TABLE public.notes ALTER COLUMN tags SET NOT NULL;
ALTER TABLE public.notes ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.notes ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.notes ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.notes ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.pages ALTER COLUMN title SET NOT NULL;
ALTER TABLE public.pages ALTER COLUMN content SET DEFAULT '';
ALTER TABLE public.pages ALTER COLUMN content SET NOT NULL;
ALTER TABLE public.pages ALTER COLUMN booklet SET DEFAULT '';
ALTER TABLE public.pages ALTER COLUMN booklet SET NOT NULL;
ALTER TABLE public.pages ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.pages ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.pages ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.pages ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.skills ALTER COLUMN title SET NOT NULL;
ALTER TABLE public.skills ALTER COLUMN content SET NOT NULL;
ALTER TABLE public.skills ALTER COLUMN tags SET DEFAULT '[]';
ALTER TABLE public.skills ALTER COLUMN tags SET NOT NULL;
ALTER TABLE public.skills ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.skills ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.skills ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.skills ALTER COLUMN updated_at SET NOT NULL;

-- 7) Indexes ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_notes_updated_at
ON public.notes (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pages_updated_at
ON public.pages (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pages_booklet
ON public.pages (booklet);

CREATE INDEX IF NOT EXISTS idx_skills_updated_at
ON public.skills (updated_at DESC);

-- 8) Row level security: only the server (service role) may touch data ---

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notes FROM anon, authenticated;
GRANT ALL ON public.notes TO service_role;

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pages FROM anon, authenticated;
GRANT ALL ON public.pages TO service_role;

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.skills FROM anon, authenticated;
GRANT ALL ON public.skills TO service_role;

-- 9) Audit: final column listing for notes, pages and skills ------------

SELECT c.table_name,
       c.column_name,
       c.data_type,
       c.is_nullable,
       c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('notes', 'pages', 'skills')
ORDER BY c.table_name, c.ordinal_position;
