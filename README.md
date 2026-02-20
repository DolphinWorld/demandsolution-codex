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

- `DATABASE_URL` (default: `file:./dev.db`)
- `AUTH_SECRET` (required for auth sessions)

Optional LLM:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)

OIDC provider (currently enabled):

- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

## Deploy to Hugging Face Spaces (Docker)

This repo includes a `Dockerfile` for Spaces. The container initializes the SQLite schema at startup using `prisma db push` and sets a default `DATABASE_URL` internally (`file:./dev.db`).

For OIDC in Spaces, configure provider callback URLs to your Space domain and set provider secrets in Space Settings -> Variables and secrets.
