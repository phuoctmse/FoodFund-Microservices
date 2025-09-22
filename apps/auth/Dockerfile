
# syntax=docker/dockerfile:1
ARG NODE_VERSION=20.18.0

# Build Stage
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx nest build auth

# Production Stage
FROM node:${NODE_VERSION}-alpine AS production
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./
# Copy proto files for gRPC service registration
COPY --from=build /usr/src/app/libs/grpc/proto ./libs/grpc/proto
RUN npm ci --omit=dev && npm cache clean --force
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs
EXPOSE 8002
CMD ["node", "dist/apps/auth/main.js"]