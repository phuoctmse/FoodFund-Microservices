
# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.20.0

# Build Stage
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx nest build graphql-gateway

# Production Stage
FROM node:${NODE_VERSION}-alpine AS production
WORKDIR /usr/src/app
RUN apk add --no-cache curl
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
EXPOSE 8000
CMD ["node", "dist/apps/graphql-gateway/main.js"]