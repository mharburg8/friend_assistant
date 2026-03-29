# ORACLE — Personal AI Operating System

## What This Is
A personal AI operating system for Mark Harburg. Next.js 16 (App Router) + Supabase + Anthropic Claude API.

## Tech Stack
- **Framework**: Next.js 16.2.1 (App Router) — NOT Next.js 14. Breaking changes apply.
- **Auth**: Supabase Auth (Google OAuth + email/password)
- **Database**: Supabase PostgreSQL + pgvector
- **AI**: Anthropic Claude API (Sonnet for chat, Haiku for routing/summarization)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Deployment**: Vercel

## Critical: Next.js 16 Patterns
- Route protection uses `proxy.ts` NOT `middleware.ts`
- `params`, `searchParams`, `headers()`, `cookies()` are all **Promises** — must be awaited
- Use Server Actions for form submissions
- Streaming uses Web ReadableStream API

## Project Structure
```
src/
  app/
    (app)/         — authenticated routes (dashboard, chat)
    api/chat/      — streaming chat endpoint
    auth/callback/ — OAuth callback
    login/         — login page
    proxy.ts       — route protection
  components/
    chat/          — ChatInterface, ChatMessages, ChatInput, MessageBubble
    layout/        — Sidebar
    ui/            — shadcn components
  lib/
    claude/        — client, system-prompt, memory
    supabase/      — client (browser), server (cookies-based)
  types/           — database types
```

## Environment Variables
Copy `.env.local.example` to `.env.local` and fill in values.

## Database
Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL Editor.
