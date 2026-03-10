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
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

WORKDIR /app

# ---- Stage 2: Production dependencies ---------------------------------------
FROM base AS deps

# Copy package files and install ONLY production dependencies
COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/

RUN npm ci --omit=dev && \
    npx prisma generate && \
    # Clean npm cache to reduce layer size
    npm cache clean --force

# ---- Stage 3: Builder -------------------------------------------------------
FROM deps AS builder

# Install ALL dependencies (including devDependencies for TypeScript compilation)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# ---- Stage 4: Production image ----------------------------------------------
FROM base AS production

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S vireos -u 1001 -G nodejs

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps --chown=vireos:nodejs /app/node_modules ./node_modules

# Copy Prisma client generated files
COPY --from=deps --chown=vireos:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled JavaScript output from builder stage
COPY --from=builder --chown=vireos:nodejs /app/dist ./dist

# Copy package.json for version info and npm scripts
COPY --chown=vireos:nodejs package.json ./

# Copy Prisma schema for migrate deploy
COPY --chown=vireos:nodejs prisma/ ./prisma/

# Switch to non-root user
USER vireos

# Expose the application port (configurable via PORT env var)
EXPOSE 3000

# Health check — Docker will monitor this endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

# Use dumb-init as PID 1 to handle signals correctly
# This ensures graceful shutdown works when Docker sends SIGTERM
ENTRYPOINT ["dumb-init", "--"]

# Default command: run the compiled server
CMD ["node", "dist/server.js"]
