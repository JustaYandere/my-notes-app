-- Lets a user opt out of receiving connection requests (they can still send
-- their own to others). Defaults to true so existing behavior is unchanged.
alter table profiles add column if not exists accepts_connections boolean not null default true;

drop policy if exists "Users can create connection requests" on connections;
create policy "Users can create connection requests"
  on connections for insert
  with check (
    auth.uid() = requester_id
    and exists (
      select 1 from profiles
      where profiles.id = recipient_id
        and profiles.accepts_connections = true
    )
  );
