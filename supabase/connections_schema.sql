-- Public profile mirror (id + email) so users can be looked up by email for connections
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique
);

alter table profiles enable row level security;

create policy "Authenticated users can look up profiles"
  on profiles for select
  to authenticated
  using (true);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill profiles for any existing users created before this trigger existed
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Connections between accounts (friend-request style: pending -> accepted)
create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (requester_id, recipient_id)
);

alter table connections enable row level security;

create policy "Users can view their own connections"
  on connections for select
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "Users can create connection requests"
  on connections for insert
  with check (auth.uid() = requester_id);

create policy "Recipients can update connection status"
  on connections for update
  using (auth.uid() = recipient_id);

create policy "Either party can remove a connection"
  on connections for delete
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

alter publication supabase_realtime add table connections;
