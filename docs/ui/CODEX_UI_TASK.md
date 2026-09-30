# Codex task — implement Canva UI concept

## Objective
Implement the competitor price monitoring PWA frontend using the Canva concept referenced in `docs/ui/README.md`.

Treat the Canva design and `UI_SPEC.md` as the UI/UX source of truth.

## Important repository constraint
This repository is currently based on **React 19 + Vite + TypeScript**.

Do **not** migrate to Next.js or replace the existing backend/PWA architecture unless a separate task explicitly requests that migration.

## Work sequence
1. Inspect the current frontend structure under `src/frontend`.
2. Read `docs/ui/README.md` and `docs/ui/UI_SPEC.md`.
3. Identify which current screens/components map to the Canva screens.
4. Before large refactors, produce a short mapping:
   `Canva screen -> existing route/view -> component(s) to reuse/change`.
5. Implement the frontend incrementally.
6. Preserve current API/backend/business behavior.
7. Run TypeScript/build checks.
8. Verify mobile layouts at 360, 390 and 430 px widths.
9. Do not deploy production unless explicitly instructed.

## Priority order
1. Price entry
2. Home / monitoring start
3. Store selection
4. Competitor selection
5. SKU list
6. Offline/sync states
7. History/profile
8. Manager/admin summary

## UX acceptance criteria
- Home -> price entry requires no more than 3 meaningful user steps.
- Price input is visually dominant and easy to use one-handed.
- Save-and-next flow is fast.
- Progress through SKU collection is visible.
- Offline records are locally preserved.
- Pending/syncing/synced/error are visually distinct.
- No duplicated UI patterns where a reusable component is appropriate.
- No unnecessary redesign beyond the supplied concept.

## Visual acceptance
Match the Canva concept as closely as practical:
- layout hierarchy;
- card structure;
- spacing rhythm;
- button prominence;
- typography hierarchy;
- state chips/banners;
- bottom navigation;
- mobile proportions.

If an exact Canva value cannot be extracted, infer conservatively from the concept rather than inventing a new visual language.

## Technical acceptance
Run:
- `npm run build`

Also run any existing project tests/checks discovered in package scripts or repository docs.

At completion report:
- files changed;
- screens implemented;
- reusable components created/reused;
- differences from Canva and why;
- build/test results;
- screenshots of key mobile screens if the environment supports them.
