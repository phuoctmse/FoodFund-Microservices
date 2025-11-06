# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.20.0

FROM node:${NODE_VERSION}-slim AS build
WORKDIR /usr/src/app
COPY package*.json ./
COPY apps/operation/package*.json ./apps/operation/
RUN npm ci
COPY . .
# Generate Prisma client for build (Windows/native)
RUN cd apps/operation && npx prisma generate
# Build application
RUN npm run build:operation

FROM node:${NODE_VERSION}-alpine AS production
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/apps/operation/package*.json ./apps/operation/
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/apps/operation/prisma ./apps/operation/prisma
COPY --from=build /usr/src/app/libs/grpc/proto ./libs/grpc/proto

# Generate Prisma client for Linux runtime in production stage
WORKDIR /usr/src/app/apps/operation
RUN npx prisma generate

# Create symlink from custom path to default Prisma location for campaign
RUN mkdir -p /usr/src/app/node_modules/.prisma && \
    ln -sf /usr/src/app/apps/operation/src/generated/operation-client /usr/src/app/node_modules/.prisma/operation-client

WORKDIR /usr/src/app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs
EXPOSE 8005
CMD ["node", "dist/apps/operation/main.js"]