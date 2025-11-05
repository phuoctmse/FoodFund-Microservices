# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.20.0

# ============================================
# Dependencies Stage - Cache npm dependencies
# ============================================
FROM node:${NODE_VERSION}-slim AS deps

WORKDIR /usr/src/app

# Copy only package files for better caching
COPY package*.json ./

# Install dependencies with cache mount for faster builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# ============================================
# Build Stage - Build application
# ============================================
FROM node:${NODE_VERSION}-slim AS build

WORKDIR /usr/src/app

# Copy dependencies from deps stage
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy package files
COPY package*.json ./

# Copy only necessary source files (exclude tests, docs, etc via .dockerignore)
COPY tsconfig*.json nest-cli.json ./
COPY apps/auth ./apps/auth
COPY libs ./libs

# Build only auth service (not entire monorepo)
RUN npx nest build auth

# ============================================
# Production Stage - Minimal runtime image
# ============================================
FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies with cache
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --prefer-offline --no-audit

# Copy built application (only dist folder)
COPY --from=build /usr/src/app/dist/apps/auth ./dist/apps/auth

# Copy proto files for gRPC
COPY --from=build /usr/src/app/libs/grpc/proto ./libs/grpc/proto

# Create non-root user and set permissions in one layer
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /usr/src/app

# Switch to non-root user
USER nestjs

# Expose ports
EXPOSE 8002 50001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/apps/auth/main.js"]
