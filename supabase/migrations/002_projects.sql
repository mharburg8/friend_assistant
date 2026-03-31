-- Projects for grouping conversations (like Claude's projects)

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  color text default '#6366f1',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  archived_at timestamptz
);

alter table projects enable row level security;
create policy "Users can CRUD own projects" on projects
  for all using (auth.uid() = user_id);

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- Add project_id to conversations
alter table conversations add column project_id uuid references projects(id) on delete set null;
create index idx_conversations_project on conversations(project_id);
