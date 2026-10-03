# Kisan 360 (Farmer 365)

Before implementing any product functionality, read these documents in full:

- [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md) — the source of truth for scope, principles, and the rules coding agents must follow (see section 25).
- [`USER_WORKFLOWS.md`](./USER_WORKFLOWS.md) — the farmer and buyer workflows the MVP must support, including the end-to-end MVP journey.
- [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) — the technology stack, code organization, layering, security, and testing rules all code must follow.
- [`DATABASE.md`](./DATABASE.md) — the PostgreSQL/Supabase data model, RLS, integrity rules, and the required migration process (section 28). Keep it updated with every schema change.
- [`docs/DEVELOPMENT_PLAN.md`](./docs/DEVELOPMENT_PLAN.md) — task plan and current status. Update it when a task is completed.

How to run, test and structure code: [`README.md`](./README.md).

## Working rules

- Build one vertical slice at a time; do not start the next one while the current one is broken.
- Before calling a task done: `npm run check`, `npm run test:integration`, `npm run test:e2e`, `npm run build`.
- All user-facing text goes in `src/lib/i18n/messages/en.ts` and `hi.ts` (same keys; a unit test checks this).
- Data access goes through `features/*/repository.ts` with the farmer's session. Never use the secret key in app code, and never weaken RLS.

@AGENTS.md
