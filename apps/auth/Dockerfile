# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.20.0

# ============================================
# Build Stage - Build application
# ============================================
FROM node:${NODE_VERSION}-slim AS build

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (needed for build)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# Copy source files
COPY tsconfig*.json nest-cli.json ./
COPY apps/auth ./apps/auth
COPY libs ./libs

# Build only auth service
RUN npm run build:auth

# ============================================
# Production Stage - Minimal runtime image
# ============================================
FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /usr/src/app

# Copy built application
COPY --from=build /usr/src/app/dist ./dist

# Copy package files
COPY --from=build /usr/src/app/package*.json ./

# Copy node_modules from build (includes all dependencies)
COPY --from=build /usr/src/app/node_modules ./node_modules

# Copy proto files for gRPC
COPY --from=build /usr/src/app/libs/grpc/proto ./libs/grpc/proto

# Create non-root user and set permissions
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
