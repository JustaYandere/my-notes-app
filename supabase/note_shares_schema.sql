-- Sharing a note with a connected account (read-only for the recipient)
create table if not exists note_shares (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  shared_with_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (note_id, shared_with_id)
);

alter table note_shares enable row level security;

create policy "Owner or recipient can view shares"
  on note_shares for select
  using (auth.uid() = owner_id or auth.uid() = shared_with_id);

create policy "Owner can share their own notes with connections"
  on note_shares for insert
  with check (
    auth.uid() = owner_id
    and exists (select 1 from notes where notes.id = note_id and notes.user_id = auth.uid())
    and exists (
      select 1 from connections
      where status = 'accepted'
        and ((requester_id = auth.uid() and recipient_id = shared_with_id)
          or (recipient_id = auth.uid() and requester_id = shared_with_id))
    )
  );

create policy "Owner or recipient can remove a share"
  on note_shares for delete
  using (auth.uid() = owner_id or auth.uid() = shared_with_id);

alter publication supabase_realtime add table note_shares;

-- Let a note be read by both its owner and anyone it's been shared with
drop policy if exists "Users can view their own notes" on notes;
create policy "Users can view their own or shared notes"
  on notes for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from note_shares
      where note_shares.note_id = notes.id
        and note_shares.shared_with_id = auth.uid()
    )
  );
