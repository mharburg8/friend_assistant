-- Initialize the database for self-hosted mode (no Supabase)
-- This runs before the schema migration

-- Create pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a simple auth schema to replace Supabase Auth
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Function to simulate auth.uid() for RLS policies
-- In self-hosted mode, this is set per-session via SET LOCAL
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('app.current_user_id', true)::UUID,
    '00000000-0000-0000-0000-000000000000'::UUID
  );
$$ LANGUAGE SQL STABLE;
