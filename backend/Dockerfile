# Build context: repo root (docker build -f backend/Dockerfile .)
FROM node:20-alpine AS build

WORKDIR /app

# Keep NODE_ENV unset during install so devDependencies (prisma CLI) install.
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

# Let Prisma resolve packages from the monorepo root when schema lives at /app/prisma
RUN ln -s /app/backend/node_modules /app/node_modules

COPY backend ./backend
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY prompts ./prompts
COPY characters ./characters

# Generate into backend/node_modules/.prisma via the root symlink resolution.
RUN cd /app/backend && npx prisma generate --schema=/app/prisma/schema.prisma

# package.json "build" also runs generate; tsc only needs client present
RUN cd /app/backend && npx tsc

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV REPO_ROOT=/app
ENV HOST=0.0.0.0
ENV CUSTOM_CHARACTERS_PATH=/data/custom-characters.json
ENV SESSIONS_PATH=/data/sessions
ENV ACCOUNTS_PATH=/data/accounts.json
ENV UPLOADS_PATH=/data/uploads
# Safe default: file-backed auth. Opt into Postgres with ACCOUNTS_PROVIDER=prisma + DATABASE_URL.
ENV ACCOUNTS_PROVIDER=json

COPY --from=build /app/backend/package.json /app/backend/package-lock.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY prompts ./prompts
COPY characters ./characters
# Pack readiness without shipping MP4s on the API image (web serves /avatar/*).
COPY frontend/public/avatar/packs/status.json ./public/avatar/packs/status.json

RUN mkdir -p /data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Apply pending Prisma migrations when DATABASE_URL is set (CharacterSession, auth, etc.).
# Skip cleanly when JSON-only / no DB — app still boots.
CMD ["sh", "-c", "if [ -n \"$DATABASE_URL\" ]; then npx prisma migrate deploy --schema=./prisma/schema.prisma; fi; exec node dist/index.js"]
