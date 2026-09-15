# Refresh this verified Node 24 LTS digest when applying base-image security updates.
FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Corepack reads the exact pnpm version from package.json. Only explicitly
# approved dependency build scripts may run (see pnpm-workspace.yaml).
RUN corepack install && pnpm install --frozen-lockfile

FROM base AS builder
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
# .dockerignore allows only application sources and build configuration.
COPY . .
RUN corepack install && pnpm build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone output includes only the dependencies traced by Next.js.
# Application files remain root-owned; only the runtime cache is writable.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
RUN mkdir -p .next/cache && chown node:node .next/cache

USER node
EXPOSE 3000 4000
CMD ["node", "server.js"]
