# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.20.0

# ============================================
# Stage 1: Build
# ============================================
FROM node:${NODE_VERSION}-slim AS build

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build user service
RUN npm run build user

# ============================================
# Stage 2: Production
# ============================================
FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /usr/src/app

# Copy built files
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/node_modules ./node_modules

# Copy proto files for gRPC (if needed in future)
COPY --from=build /usr/src/app/libs/grpc/proto ./libs/grpc/proto

# Copy Prisma files
COPY --from=build /usr/src/app/apps/user/prisma ./apps/user/prisma
COPY --from=build /usr/src/app/apps/user/src/generated ./apps/user/src/generated

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /usr/src/app

USER nestjs

# Expose ports
EXPOSE 8003

# Start application
CMD ["node", "dist/apps/user/main.js"]
