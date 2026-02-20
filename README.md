---
title: Demand Solution Board
emoji: 📌
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
---

# Demand Solution Board (V0.1)

Community Demand -> Requirements Board.

Users submit vague product ideas. The app generates a structured specification (problem statement, features, implementation tasks, open questions), and the community can upvote, comment, and claim tasks with links to repos/PRs.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma + SQLite
- OpenAI API (optional; app has fallback generation if key is missing)

## Core Features

- Cookie-based anonymous identity (`anon_id` UUID, no login)
- Idea submission + LLM spec generation
- Home feed with Hot/New sorting
- Upvotes and comments
- Task claim/unclaim, status updates, and implementation links
- Nickname by anonymous identity
- Basic rate limiting for idea submission (per anon ID + IP)

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

- `DATABASE_URL` (default: `file:./dev.db`)
- `OPENAI_API_KEY` (optional)
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)

## Deploy to Hugging Face Spaces (Docker)

This repo includes a `Dockerfile` for Spaces. After creating a Docker Space, set optional secrets:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional)

The container initializes the SQLite schema at startup using `prisma db push`.
