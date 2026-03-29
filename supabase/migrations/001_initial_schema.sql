-- ORACLE Database Schema
-- Run this in Supabase SQL Editor

-- Enable pgvector for semantic memory
create extension if not exists vector;

-- Conversations
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  mode text check (mode in ('alab', 'work', 'jobsearch', 'school', 'personal', 'dev')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  archived_at timestamptz
);

alter table conversations enable row level security;
create policy "Users can CRUD own conversations" on conversations
  for all using (auth.uid() = user_id);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model_used text,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz default now() not null
);

alter table messages enable row level security;
create policy "Users can CRUD own messages" on messages
  for all using (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );

create index idx_messages_conversation on messages(conversation_id, created_at);

-- Memory nodes (mid-term + long-term memory)
create table memory_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('summary', 'fact', 'sentiment', 'profile_update')),
  content text not null,
  summary text,
  sentiment text,
  source_conversation_id uuid references conversations(id) on delete set null,
  embedding vector(1536),
  created_at timestamptz default now() not null
);

alter table memory_nodes enable row level security;
create policy "Users can CRUD own memory nodes" on memory_nodes
  for all using (auth.uid() = user_id);

-- Index for semantic search
create index idx_memory_embedding on memory_nodes
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- User profile (evolving JSON document)
create table user_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  profile_json jsonb not null default '{}',
  updated_at timestamptz default now() not null
);

alter table user_profile enable row level security;
create policy "Users can CRUD own profile" on user_profile
  for all using (auth.uid() = user_id);

-- Action log (autonomous agent accountability)
create table action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  action text not null,
  reasoning text,
  status text default 'completed' check (status in ('pending', 'completed', 'failed', 'rejected')),
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

alter table action_log enable row level security;
create policy "Users can read own action log" on action_log
  for all using (auth.uid() = user_id);

-- Weekly priorities
create table priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_of date not null,
  priority_text text not null,
  rank integer not null check (rank between 1 and 10),
  completed boolean default false,
  created_at timestamptz default now() not null
);

alter table priorities enable row level security;
create policy "Users can CRUD own priorities" on priorities
  for all using (auth.uid() = user_id);

-- Function to auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at();

create trigger user_profile_updated_at
  before update on user_profile
  for each row execute function update_updated_at();

-- Seed profile function (call after first user signs up)
-- This inserts Mark's seed profile from the spec
create or replace function seed_user_profile(p_user_id uuid)
returns void as $$
begin
  insert into user_profile (user_id, profile_json)
  values (p_user_id, '{
    "name": "Mark Harburg",
    "location": "Detroit / Michigan area",
    "companies": {
      "harburg_automation": "AI automation, voice agents, workflows — founder",
      "inner_child_apparel": "New York registered apparel brand — founder",
      "practice_management_saas": "in development"
    },
    "job_search": {
      "status": "active",
      "target_roles": ["Pre-Sales Engineer", "Solutions Consultant", "Sales Engineer"],
      "location_pref": "Detroit metro or remote",
      "prior_experience": "M-Files — AI automation and technical integrations"
    },
    "education": "Masters in Clinical Mental Health Counseling, Eastern Michigan University",
    "family_legacy": "Descendant of Yip Harburg — lyricist (Over the Rainbow, Brother Can You Spare a Dime)",
    "life_context": {
      "wedding": "June 7 — forestry/eclectic theme",
      "cat": "Simon — 6-year-old tabby",
      "hobbies": ["trumpet (beginner)", "building things"],
      "returned_to_michigan": 2025
    },
    "active_projects": [
      "ORACLE personal assistant app",
      "practice management SaaS",
      "consciousnesslayers.com (3D interactive Hawkins Map)",
      "innerchild.chat (AI voice inner child healing tool)",
      "laser device (EDM/festival use)",
      "AWS infrastructure (Ubuntu at 3.138.91.167)",
      "A:LAB consulting (Robbie and Rebecca)",
      "LinkedIn content series (30 days vulnerability/psychological safety)"
    ],
    "technical_profile": {
      "stack": ["Next.js 14", "TypeScript", "Supabase", "Prisma", "PostgreSQL", "AWS", "Vercel", "Twilio", "Stripe", "Anthropic Claude API", "Claude Code", "MCP servers", "Retell AI"],
      "github": "mharburg8"
    },
    "communication_style": "Direct. No filler. Real opinions welcome. Treat as a peer. Lead with the answer. Push back when needed.",
    "sentiment": {
      "job_search": "active and motivated but juggling many competing priorities",
      "building": "high energy, genuinely excited about whats possible with AI",
      "general": "someone carrying a lot at once and doing it intentionally"
    }
  }'::jsonb)
  on conflict (user_id) do nothing;
end;
$$ language plpgsql;
