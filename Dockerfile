# Multi-stage Dockerfile for Next.js (pnpm) app
# Builds with dev deps, prunes to prod deps, and runs `next start`

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- Dependencies ----------
FROM base AS deps
# Optional: compatibility libs often needed with Next.js on Alpine
RUN apk add --no-cache libc6-compat

# Enable pnpm via corepack (or install a specific pnpm version)
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Install dependencies based on lockfile for best caching
COPY pnpm-lock.yaml* pnpm-workspace.yaml* package.json ./
RUN pnpm install --frozen-lockfile

# ---------- Builder ----------
FROM base AS builder
ENV NODE_ENV=development
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js
RUN pnpm build

# Prune to production-only dependencies to shrink runtime image
RUN pnpm prune --prod

# ---------- Runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user and set ownership
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Copy the minimal runtime artifacts
COPY --chown=nextjs:nextjs --from=builder /app/node_modules ./node_modules
COPY --chown=nextjs:nextjs --from=builder /app/package.json ./package.json
COPY --chown=nextjs:nextjs --from=builder /app/next.config.ts ./next.config.ts
COPY --chown=nextjs:nextjs --from=builder /app/public ./public
COPY --chown=nextjs:nextjs --from=builder /app/.next ./.next

USER nextjs

EXPOSE 3000 4000

# Start Next.js without requiring pnpm in the runner
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]


