-- File attachments
create table attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete set null,
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  s3_key text not null,
  created_at timestamptz default now() not null
);

create index idx_attachments_message on attachments(message_id);
create index idx_attachments_conversation on attachments(conversation_id);

alter table attachments enable row level security;

create policy "Users can view own attachments"
  on attachments for select
  using (auth.uid() = user_id);

create policy "Users can insert own attachments"
  on attachments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own attachments"
  on attachments for delete
  using (auth.uid() = user_id);
