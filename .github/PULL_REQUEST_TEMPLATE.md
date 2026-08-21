<!--
Thanks for contributing to Procharacters.cloud.
Keep the title in Conventional Commits form, e.g. `feat(chat): ...`, `fix(api): ...`,
`chore(ci): ...`, `test(backend): ...`, `docs: ...`.
-->

## Summary

<!-- What does this PR do, and why? 1–3 sentences. -->

## Changes

<!-- Bullet the notable changes. Call out anything touching hot files
     (e.g. ChatApp.tsx, session-manager.ts) or shared config. -->

-

## Testing

<!-- How did you verify this? Paste key command output or screenshots. -->

-

## Checklist

- [ ] Ran the relevant gates locally (see [CONTRIBUTING.md](../CONTRIBUTING.md)):
  - Backend: `cd backend && npm run lint && npm run typecheck && npm test`
  - Frontend: `cd frontend && npm run lint && npm test && npm run build`
  - Python: `ruff check app && ruff format --check app && python scripts/run_all_tests.py --skip-stress`
- [ ] Formatted changed files (`npm run format` in the touched package; `ruff format app` for `app/`).
- [ ] Live IDs are unchanged (Pack 01/02/03 character ids must stay stable).
- [ ] Age floor respected — all models and copy are 21+ consenting adults.

## Linked issues

<!-- e.g. Closes #123 -->
