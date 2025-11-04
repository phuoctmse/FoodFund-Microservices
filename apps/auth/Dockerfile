# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.20.0

# ============================================
# Build Stage
# ============================================
FROM node:${NODE_VERSION}-slim AS build

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build auth service
RUN npx nest build auth

# ============================================
# Production Stage
# ============================================
FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /usr/src/app

# Copy built application
COPY --from=build /usr/src/app/dist ./dist

# Copy package files
COPY --from=build /usr/src/app/package*.json ./

# Copy proto files for gRPC (required for runtime)
COPY --from=build /usr/src/app/libs/grpc/proto ./libs/grpc/proto

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Change ownership
RUN chown -R nestjs:nodejs /usr/src/app

# Switch to non-root user
USER nestjs

# Expose ports
EXPOSE 8002 50001
# 8002: GraphQL/HTTP API
# 50001: gRPC API

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/apps/auth/main.js"]