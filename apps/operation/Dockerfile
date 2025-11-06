# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.20.0

# Build Stage
FROM node:${NODE_VERSION}-slim AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --ignore-scripts
COPY tsconfig*.json nest-cli.json ./
COPY apps/operation ./apps/operation
COPY libs ./libs
RUN cd apps/operation && npx prisma generate
RUN npm run build:operation

# Production Stage
FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /usr/src/app

RUN apk add --no-cache curl
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/package-lock.json ./package-lock.json
COPY --from=build /usr/src/app/apps/operation/prisma ./apps/operation/prisma
COPY --from=build /usr/src/app/libs/grpc/proto ./libs/grpc/proto
RUN npm ci --omit=dev && npm cache clean --force
RUN cd apps/operation && npx prisma generate

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /usr/src/app
USER nestjs
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
CMD curl -f http://localhost:8005/health || exit 1
EXPOSE 8005
CMD ["node", "dist/apps/operation/main.js"]