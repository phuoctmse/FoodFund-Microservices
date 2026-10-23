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
    npm ci --prefer-offline --no-audit --ignore-scripts

# Copy source files
COPY tsconfig*.json nest-cli.json ./
COPY apps/user ./apps/user
COPY libs ./libs

# Generate Prisma client for build
RUN cd apps/user && npx prisma generate

# Build only user service
RUN npm run build:user

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

# Copy Prisma schema
COPY --from=build /usr/src/app/apps/user/prisma ./apps/user/prisma

# Copy proto files
COPY --from=build /usr/src/app/libs/grpc/proto ./libs/grpc/proto

# Generate Prisma client for Alpine Linux runtime
WORKDIR /usr/src/app/apps/user
RUN npx prisma generate

WORKDIR /usr/src/app

# Create non-root user and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /usr/src/app

# Switch to non-root user
USER nestjs

# Expose ports
EXPOSE 8001 50002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/apps/user/main.js"]