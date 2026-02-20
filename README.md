---
title: Demand Solution Board
emoji: 📌
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
---

# Demand Solution Board

Community Demand -> Requirements Board.

Users submit product ideas and the app generates structured specs (features + tasks). Community members validate demand, developers coordinate implementation, and submitters approve solutions.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL (Supabase recommended)
- NextAuth (OIDC) + Prisma Adapter
- OpenAI API (optional; fallback generation if key is missing)

## Features

- OIDC login support (Google) for now
- Anonymous posting by default; logged-in submitters can show visible name
- Developer profiles (display name, headline, bio, links)
- Idea/task work votes: developers signal they are working on specific scope
- Task claim/unclaim, status updates, implementation links
- Solution submissions (app URL / GitHub repo / other)
- Idea submitter can approve a solution
- Solution like/unlike voting and threaded solution comments
- Cookie-based anonymous identity still supported for non-auth usage

## Run Locally

```bash
npm install
npm run prisma:generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Copy `.env.example` to `.env`.

Required baseline:

- `DATABASE_URL` (set to Supabase Postgres URL)
- `AUTH_SECRET` (required for auth sessions)
- `AUTH_URL` (required in proxied hosting; for HF use your `.hf.space` domain)

Optional LLM:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)

OIDC provider (currently enabled):

- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

## Supabase setup

1. Create a Supabase project.
2. In Supabase -> Settings -> Database, copy the connection string (URI).
3. In HF Space secrets, set:
   - `DATABASE_URL` to Supabase Postgres URI
   - keep `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
4. Redeploy/restart Space.

The app runs `prisma db push` on startup, so schema is applied to your Supabase DB automatically.

## Deploy to Hugging Face Spaces (Docker)

This repo includes a `Dockerfile` for Spaces. `DATABASE_URL` is required at runtime; if missing, container startup fails fast with a clear error.

For OIDC in Spaces, set `AUTH_URL` to your direct Space domain (for this app: `https://jacksuyu-demandsolution-codex.hf.space`) and configure Google callback URL:

- `https://jacksuyu-demandsolution-codex.hf.space/api/auth/callback/google`
