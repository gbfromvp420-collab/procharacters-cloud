# Pull Request: chore(ci): add CI + lint workflows, Dependabot, and CONTRIBUTING.md

This PR adds initial CI and developer tooling to the repository:

Files added:
- .github/workflows/ci.yml — Monorepo CI with a job matrix for frontend, backend, and the Python app. Runs install, build, and basic smoke tests. Uploads artifacts on failure/success.
- .github/workflows/lint.yml — Linting workflow that runs on PRs and weekly via cron. Runs frontend lint, backend typecheck, and a lightweight Python ruff check.
- .github/dependabot.yml — Dependabot configuration for npm (root/frontend/backend) and pip (root).
- CONTRIBUTING.md — Developer quick-start, local dev via docker-compose, and PR checklist.
- README_BADGES.md — Badge placeholders for CI and Dependabot status.

Notes and follow-ups:
- The Python app (app/) has heavy native deps (aiortc/av/ffmpeg). The CI job currently installs requirements but intentionally skips heavy tests. We can add matrix variants or use a Docker image with FFmpeg if you want full app test coverage in CI.
- The backend job runs `npm run prisma:generate` and `npm run test:memory` which assumes no external Postgres. For full integration tests, we should provision a Postgres service in the workflow and set DATABASE_URL.
- Please add the following repository secrets if you want the CI to run full integrations and publish images:
  - DATABASE_URL
  - GHCR_PAT (if publishing to GitHub Container Registry)
  - Any provider keys (XAI_API_KEY, LIVEKIT_API_KEY/SECRET) are optional and only needed to run real LLM/livekit tests.

Merge checklist:
- [ ] Ensure maintainers have a look and approve
- [ ] Add any required secrets if you expect integration tests to run
- [ ] Optional: update workflows to publish images on tag
