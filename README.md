# DocNexus Outreach

A physician-outreach platform for pharmaceutical commercial teams — sales, marketing, and medical science liaisons (MSLs) who run targeted campaigns to physicians (HCPs). It demonstrates the core commercial loop end to end: **discover physicians → build a targeted list → create a multi-step campaign → send personalized messages (real via Gmail SMTP for allowlisted recipients, simulated for everyone else) → track results on a dashboard.** It's built for a professional at a desk comparing this to Salesforce Health Cloud / Veeva, so the UI is dense, scannable, and fast — no consumer fluff.

This is a take-home submission for a Full Stack Engineer internship at DocNexus.ai.

## Live demo

**https://docnexus.kvharshaavardhana.uk**

Deployed on Vercel, served behind my own domain via Cloudflare DNS (SSL end to end). The deployed instance runs on Neon Postgres; local development uses SQLite.

> Physician records are fabricated for the demo. Real email sending is restricted to an allowlist (see [Honest limitations](#honest-limitations)); everyone else is recorded as a simulated send.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Server Components fetch data directly; one codebase for UI + API routes. |
| Language | TypeScript (strict) | No `any`; types shared client-to-server via zod inference. |
| ORM / DB | Prisma 7 — SQLite (dev), Neon Postgres (prod) | Driver adapters let one schema target both; SQLite needs zero local setup, Neon is serverless-friendly for Vercel. |
| UI | shadcn/ui + Tailwind CSS | Accessible primitives, owned in-repo, styled to a tight zinc/teal system. |
| Validation | zod | One schema validates the API boundary and the react-hook-form client. |
| AI | Google Gemini → OpenAI → Groq fallback | Drafting/personalization in the builder; fallbacks keep it working when a provider rate-limits. |
| Email | Nodemailer + Gmail SMTP | Real STARTTLS sends, guarded by an allowlist to protect sender reputation. |
| Charts | Recharts | The dashboard activity chart. |

## Architecture

Three UI modules talk to thin API routes; all business logic lives in a service layer that owns Prisma. Server Components import services directly; Client Components call the API. AI is only ever invoked from the builder — never at send time.

```
┌─────────────────────────────────────────────────────────────────────┐
│  UI (Next.js App Router)                                            │
│  Module 1: Physician Discovery    Module 2: Campaign Builder        │
│  Module 3: Campaign Dashboard                                       │
└──────────────┬────────────────────────────────┬────────────────────-┘
   Server Components             Client Components │ (fetch)
   import services directly                        ▼
                          ┌──────────────────────────────────────────┐
                          │  API routes (thin: validate → call → map)│
                          │  /api/physicians   /api/campaigns/*      │
                          │  /api/ai/draft     /api/campaigns/draft-*│
                          └───────────────┬──────────────────────────┘
                                          ▼
              ┌─────────────────────────────────────────────────────┐
              │  Service layer (lib/services)                       │
              │  physicians · campaigns · ai · mailer               │
              └───┬───────────────┬──────────────────┬──────────────┘
                  ▼               ▼                  ▼
          ┌────────────┐   ┌─────────────┐   ┌──────────────────┐
          │  Prisma 7  │   │ AI provider │   │ Mailer           │
          │  adapter   │   │ chain       │   │ Gmail SMTP       │
          │  picks DB  │   │ Gemini →    │   │ + allowlist      │
          │  by URL    │   │ OpenAI →    │   │ guard            │
          │            │   │ Groq        │   │ (else simulated) │
          └─────┬──────┘   └─────────────┘   └──────────────────┘
                ▼
     SQLite (dev) / Neon Postgres (prod)
```

**Thin routes, logic in services.** Every route handler does exactly three things: parse/validate with zod, call a `lib/services` function, map the result to an HTTP response. No raw Prisma in routes, no business logic in components.

**Launch drain.** `PATCH /launch` writes one `PendingSend` per enrollment × step, returns `202`, then fires a background drain (`setImmediate`). The drain renders each email — a saved per-physician override verbatim, otherwise the shared template with `{{variables}}` substituted — and sends via the mailer. No AI runs at send time; the content is final by launch.

## Features by module

### Module 1 — Physician Discovery
- Filterable directory: specialty, sub-specialty, state, affiliation, minimum years of experience, and token-based name search. Filters live in the URL (shareable, back-button friendly) and trigger a server refetch.
- "Clear all filters" appears only when a filter is active.
- Multi-select with a sticky selection bar ("X of Y physicians — N selected"); selection persists in `sessionStorage` across navigation.
- On the unfiltered list, selected physicians pin to the top in selection order; once any filter is active, server order is preserved.

### Module 2 — Campaign Builder
- Three-step flow: Details → Sequence → Review, with per-step validation before advancing.
- Campaign types: cold outbound, re-engagement, conference follow-up.
- Multi-step sequences: step 1 sends immediately; follow-ups send N days later. Clickable variable chips insert `{{first_name}}`, `{{doctor_name}}`, `{{affiliation}}`, etc.
- **Shared template, AI-assisted:** "Generate with AI" drafts the shared subject/body that everyone gets (editable; it's what's sent).
- **Per-physician overrides:** "Personalize for selected physician" generates a custom version for one physician, optionally based on free-text instruction (e.g. "we met at ASCO 2025"). Overrides are sent verbatim and take precedence over the shared template.
- Live preview panel renders the email against any selected physician — the override verbatim, or the shared template with that physician's details filled in.
- Review step lists every recipient with a "Personalized" tag where an override exists. Save as draft or launch.

### Module 3 — Campaign Dashboard
- Header with campaign status (Draft / Active / Completed) and created date.
- Live progress bar while active: polls progress every 3 seconds, shows "Sent X of Y · N pending", and transitions to Completed when the queue drains.
- Stat cards: Physicians Enrolled, Messages Sent (with a real/simulated split), Open Rate, Replies, Meetings Booked.
- Recharts activity chart (last 7 days).
- Enrolled-physician table with per-contact status (Pending / Contacted / Replied / Bounced) and a "Personalized" tag for overridden recipients.
- Drafts show zeros / pending — mock engagement metrics only appear once a campaign is active or completed.

## API reference

All routes are thin wrappers over the service layer; bodies and query params are zod-validated.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/physicians` | List/filter physicians (specialty, sub-specialty, state, affiliation, min years, search, pagination). |
| GET | `/api/campaigns` | List campaigns with enrollment counts. |
| POST | `/api/campaigns` | Create a campaign (name, type, sequence steps, enrolled physician IDs). |
| GET | `/api/campaigns/:id` | Fetch one campaign with sequences and enrolled physicians. |
| PATCH | `/api/campaigns/:id/launch` | Transition draft → active, queue sends, start the background drain. |
| GET | `/api/campaigns/:id/progress` | Drain progress (`sent`, `pending`, `simulated`, `real`) for dashboard polling. |
| POST | `/api/campaigns/:id/overrides` | Persist per-physician overrides accumulated in the builder. |
| POST | `/api/campaigns/draft-override` | Generate a per-physician override draft (AI), before the campaign exists. |
| POST | `/api/ai/draft` | Generate the shared-template brief (AI) for a campaign type + step. |

## Local setup

Requires Node 20+ and npm.

```bash
git clone <repo-url>
cd docnexus-outreach
npm install

cp .env.example .env        # then fill in any keys you want (all optional for a basic run)

npx prisma generate         # generate the Prisma client
npx prisma db push          # create the SQLite schema (dev.db)
npx prisma db seed          # load 36+ fabricated physicians

npm run dev                 # http://localhost:3000
```

With no AI keys set, "Generate with AI" degrades gracefully (returns a clear error). With no SMTP creds, every send is recorded as simulated — the app is fully usable for the demo loop either way. See [`.env.example`](./.env.example) for all variables.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | `file:./dev.db` for SQLite locally; a Neon Postgres URL in prod. The Prisma adapter is chosen from this value. |
| `GEMINI_API_KEY` | Recommended | Primary AI provider (Google AI Studio) for drafting/personalization. |
| `OPENAI_API_KEY` | Optional | Fallback if Gemini fails (`gpt-4o-mini`). |
| `GROQ_API_KEY` | Optional | Second fallback if OpenAI fails (`llama-3.1-8b-instant`). |
| `SMTP_USER` | Optional | Gmail address for real sends. Omit to simulate all sends. |
| `SMTP_APP_PASSWORD` | Optional | Gmail app password (requires 2FA). |
| `ALLOWED_TEST_RECIPIENTS` | Optional | Comma-separated inboxes that receive real email; everything else is recorded as simulated. |

## Key design decisions

**Shared template with optional per-physician overrides.** A campaign defines one shared template that every enrolled physician receives (with their details substituted), and the user can opt into a custom override for any individual. This is the scale-versus-personalization tradeoff a real outreach tool faces: most recipients are fine with a good templated message, but the high-value ones deserve a tailored note. The default path stays cheap (one template, rendered per recipient); the exception path is precise (a verbatim override). Overrides always win at send time.

**AI provider fallback chain.** Drafting goes Gemini → OpenAI → Groq, all behind one `callLLM` helper. Free AI tiers rate-limit aggressively and tend to fail at the worst moment — a live demo. The chain tries each configured provider in order and only surfaces an error when all of them fail, so a single provider hiccup never blocks the workflow. AI is confined to the builder; the send path never calls it, so what the user sees is exactly what's sent.

**Allowlist-guarded real sending.** The seed data uses fabricated `@example-hospital.org` addresses. Blasting those through Gmail would generate bounces and quickly damage the sender's reputation and deliverability. So `ALLOWED_TEST_RECIPIENTS` gates real delivery: allowlisted addresses get a genuine STARTTLS send; everything else is recorded with `simulated: true`. The demo proves real sending works without risking the account.

**Thin routes, service layer.** Route handlers only validate, delegate, and map to HTTP; all business logic lives in `lib/services` and is the only place that touches Prisma. This keeps endpoints trivial to read, lets Server Components reuse the same logic without an HTTP hop, and concentrates the parts worth testing. No speculative patterns (factories, DI containers) — just one clear boundary.

## What I'd build next

- **Auth and multi-tenancy** — accounts, teams, and per-org data isolation.
- **Durable send queue** — replace the fire-and-forget drain with a managed queue (e.g. Inngest) so launches survive restarts and scale.
- **Real reply detection** — read replies via the Gmail API to make "Replied" status and reply rate real instead of mock.
- **Production email infrastructure** — move off Gmail SMTP to a provider with bounce/complaint webhooks (e.g. SES/Postmark) for real deliverability handling.
- **NPPES enrichment** — pull live physician data from the NPPES registry instead of fabricated records.
- **Saved segments** — persist filter sets as reusable audiences.
- **CRM integration** — sync campaigns and engagement back to Salesforce / Veeva.

## Honest limitations

- **Engagement metrics are mock.** Open rate, reply rate, meetings booked, the activity chart, and any "Replied" status are deterministically derived from the campaign ID — there is no inbox reading yet. They render only for active/completed campaigns; drafts show zeros. Real send/contacted/bounced status from actual sends always takes precedence over the mock.
- **The launch drain isn't durable.** It runs fire-and-forget via `setImmediate`. If a serverless instance is recycled mid-drain, the remaining `PendingSend` rows persist but aren't automatically retried (a re-launch endpoint or a real queue would handle this).
- **Real sends are allowlist-restricted.** Only addresses in `ALLOWED_TEST_RECIPIENTS` receive real email; everything else is simulated. This is intentional — it protects sender reputation given the fabricated seed data.