-- Notes table for cross-device sync
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  mode text not null default 'note',
  checklist jsonb not null default '[]',
  pinned boolean not null default false,
  hidden boolean not null default false,
  tags jsonb not null default '[]',
  color text,
  voice_notes jsonb not null default '[]',
  reminder_at timestamptz,
  reminder_notified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Row Level Security: each user can only see/touch their own notes
alter table notes enable row level security;

create policy "Users can view their own notes"
  on notes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notes"
  on notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on notes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on notes for delete
  using (auth.uid() = user_id);

-- Keep updated_at fresh automatically
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger notes_set_updated_at
  before update on notes
  for each row
  execute function set_updated_at();

-- Enable realtime so other devices see changes live
alter publication supabase_realtime add table notes;
