-- Job applications tracker (career-ops integration)
create table job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company text not null,
  role text not null,
  url text,
  archetype text check (archetype in (
    'ai_platform', 'agentic', 'technical_pm',
    'solutions_architect', 'forward_deployed', 'transformation'
  )),
  score numeric(2,1) check (score >= 0 and score <= 5),
  status text default 'evaluated' check (status in (
    'evaluated', 'applied', 'responded', 'interview',
    'offer', 'rejected', 'discarded', 'skip'
  )),
  evaluation jsonb default '{}',
  notes text,
  report_md text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  unique(user_id, company, role)
);

alter table job_applications enable row level security;
create policy "Users can CRUD own applications" on job_applications
  for all using (auth.uid() = user_id);

create index idx_job_apps_user_status on job_applications(user_id, status);
create index idx_job_apps_score on job_applications(user_id, score desc);

create trigger job_applications_updated_at
  before update on job_applications
  for each row execute function update_updated_at();
