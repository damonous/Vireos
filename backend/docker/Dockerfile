# =============================================================================
# Vireos Backend — Multi-stage Dockerfile
#
# Stages:
#   1. base        — Node.js 20 Alpine with common tooling
#   2. deps        — Production dependencies only
#   3. builder     — Full dependencies + TypeScript compilation
#   4. production  — Minimal image with compiled output
# =============================================================================

# ---- Stage 1: Base image -----------------------------------------------------
FROM node:20-slim AS base

# Install runtime utilities
RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init ca-certificates openssl && \
    rm -rf /var/lib/apt/lists/*

# ---- Stage 2: Backend production dependencies --------------------------------
FROM base AS backend-deps
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json* ./
COPY backend/prisma/schema.prisma ./prisma/

RUN npm ci --omit=dev && \
    npx prisma generate && \
    npm cache clean --force

# ---- Stage 3: Backend builder ------------------------------------------------
FROM backend-deps AS backend-builder
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src

RUN npm run build

# ---- Stage 4: Frontend builder ----------------------------------------------
FROM base AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---- Stage 5: Production image ----------------------------------------------
FROM base AS production

RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid 1001 --create-home --shell /usr/sbin/nologin vireos

WORKDIR /app/backend

# Backend runtime artifacts
COPY --from=backend-deps --chown=vireos:nodejs /app/backend/node_modules ./node_modules
COPY --from=backend-deps --chown=vireos:nodejs /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder --chown=vireos:nodejs /app/backend/dist ./dist
COPY --chown=vireos:nodejs backend/package.json ./
COPY --chown=vireos:nodejs backend/prisma ./prisma

# Frontend static bundle (served by Express)
COPY --from=frontend-builder --chown=vireos:nodejs /app/frontend/dist ./public

COPY --chown=vireos:nodejs backend/docker/entrypoint.sh /usr/local/bin/vireos-entrypoint.sh
RUN chmod +x /usr/local/bin/vireos-entrypoint.sh && mkdir -p /app/backend/certs && chown -R vireos:nodejs /app/backend/certs

USER vireos

EXPOSE 3000 3443

ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/vireos-entrypoint.sh"]
CMD ["node", "dist/server.js"]
