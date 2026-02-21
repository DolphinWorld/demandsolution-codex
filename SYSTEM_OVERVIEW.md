# Community Demand -> Requirements Board

## 1) Purpose
This system turns free-form product demand posts into buildable requirement boards, then lets the community validate demand and developers submit solutions.

Current behavior is optimized for:
- Fast submission with no required account for idea posting.
- Optional Google login for developer and ownership workflows.
- Public idea discussion and iterative solution validation.

## 2) Tech Stack
- Frontend/App: Next.js (App Router) + TypeScript + Tailwind.
- ORM/DB: Prisma + PostgreSQL (Supabase recommended for hosted persistence).
- Auth: NextAuth with Google provider.
- LLM: OpenAI API (server-side only), with fallback generation when provider/network fails.
- Hosting: Hugging Face Space and GitHub repo.

## 3) Core Product Flows
### A. Idea Submit -> Spec
1. User submits free-text idea (+ optional target users/platform/constraints).
2. Backend validates content and rate limits.
3. Backend checks offensive text and duplicate/subset match.
4. If duplicate/subset is detected, submission is merged into an existing idea.
5. Otherwise, LLM generates structured output and idea/tasks are saved.

### B. Community Validation
- Public idea list supports Hot/New sort.
- Users can upvote and comment.
- Developer interest is visible via "Working on this" votes.

### C. Developer Delivery
- Developers can claim tasks and mark task-level progress.
- Solution submission is allowed only after developer marks "Working on this".
- Solutions can be voted/commented by community.
- Idea submitter can approve a solution.

## 4) Identity and Access Model
- Anonymous identity is persisted with `anon_id` cookie.
- Authenticated identity (Google) is used for developer profile and privileged actions.
- Idea delete permission:
  - Idea owner can delete.
  - Admin override is hardcoded to `jacksuyu@gmail.com`.

## 5) Data Model Highlights
Defined in `/Users/jacksu/projects/demandsolution_codex/prisma/schema.prisma`.

Main entities:
- `Idea`: raw input, generated spec summary, ownership, counters.
- `Task`: generated work items, claim status, links.
- `Comment`, `Vote`, `IdeaUserVote`, `IdeaWorkVote`, `TaskWorkVote`.
- `Solution`: developer submissions and submitter approval state.
- `IdeaMerge`: audit log for duplicate/subset merged submissions.

## 6) Dedup and Moderation
- Dedup uses token normalization, stemming/synonym mapping, unigram/bigram overlap, and subset scoring.
- Offensive/inappropriate text is blocked before generation.
- Submission rate limit is currently `20 submissions/hour` (testing configuration).

## 7) Key Pages
- `/`: idea board (Hot/New, voting signals, developer interest count).
- `/submit`: idea submission and generation.
- `/ideas/:id`: simplified idea detail (original submission, tasks, comments, gated solution submit).
- `/ideas/:id/solutions`: dedicated solutions list with vote/comment/approve actions.

## 8) API Surface (Main)
- Ideas: `GET/POST /api/ideas`, `GET/DELETE /api/ideas/:id`.
- Voting: `POST/DELETE /api/ideas/:id/upvote`.
- Idea work vote: `POST/DELETE /api/ideas/:id/work-vote`.
- Comments: `GET/POST /api/ideas/:id/comments`.
- Tasks: claim/unclaim/status/links/work-vote routes.
- Solutions: `GET/POST /api/ideas/:id/solutions`, per-solution vote/comment/approve routes.

## 9) Environment Variables
Minimum variables for hosted deployment:
- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default set in code)
- `AUTH_URL` / `NEXTAUTH_URL` should match the public app domain

## 10) Build and Deploy
From `/Users/jacksu/projects/demandsolution_codex`:
1. `npm ci`
2. `npm run prisma:generate`
3. `npm run build`
4. Deploy container/app with `DATABASE_URL` configured.
5. On runtime startup, apply schema sync (`prisma db push`) before app start.

## 11) Verification Checklist
- Submit idea -> detail page created.
- Submit near-duplicate -> merged notice and redirect.
- Vote/comment works.
- Developer marks "Working on this" -> solution form appears.
- Solution list page shows all submissions.
- Idea submitter can approve solution.
- Owner/admin can delete idea.

## 12) Current Scope Notes
- No payment/bounty workflow.
- No advanced moderation tooling beyond basic offensive-text blocking.
- Identity is best-effort anonymous + optional auth, not high-security account governance.
