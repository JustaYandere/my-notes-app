-- Run this once in the Supabase SQL editor if your `notes` table was
-- created before image support was added — it adds the missing column.
alter table notes add column if not exists images jsonb not null default '[]';
