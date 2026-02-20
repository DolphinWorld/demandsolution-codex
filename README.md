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
- Prisma + SQLite
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

- `DATABASE_URL` (local default: `file:./dev.db`)
- `AUTH_SECRET` (required for auth sessions)
- `AUTH_URL` (required in proxied hosting; for HF use your `.hf.space` domain)

Optional LLM:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)

OIDC provider (currently enabled):

- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

## Prevent data loss on Hugging Face Spaces

SQLite in the container filesystem is ephemeral. To persist posts across deploys:

1. In Space Settings, enable **Persistent storage**.
2. Ensure `DATABASE_URL` points to `/data`:
   - `DATABASE_URL=file:/data/dev.db`

This repo's Docker image already defaults to `file:/data/dev.db`.

## Deploy to Hugging Face Spaces (Docker)

This repo includes a `Dockerfile` for Spaces. The container runs `prisma db push` at startup and uses `/data` for SQLite so data survives redeploys when Persistent Storage is enabled.

For OIDC in Spaces, set `AUTH_URL` to your direct Space domain (for this app: `https://jacksuyu-demandsolution-codex.hf.space`), configure Google callback URL, and set secrets in Space Settings -> Variables and secrets.
