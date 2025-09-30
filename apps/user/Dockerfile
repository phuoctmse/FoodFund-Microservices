# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.20.0

# Build Stage
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /usr/src/app
COPY package*.json ./
COPY apps/user/package*.json ./apps/user/
RUN npm ci
COPY . .
# Generate Prisma client for build (needed for compilation)
RUN cd apps/user && npx prisma generate
# Build application 
RUN npm run build:user

# Production Stage
FROM node:${NODE_VERSION}-alpine AS production
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/apps/user/package*.json ./apps/user/
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/apps/user/prisma ./apps/user/prisma
# Copy generated client from build stage as starting point
COPY --from=build /usr/src/app/apps/user/src/generated ./apps/user/src/generated
# Copy proto files
COPY --from=build /usr/src/app/libs/grpc/proto ./libs/grpc/proto

# Regenerate Prisma client for Linux runtime (overwrite Windows binaries)
WORKDIR /usr/src/app/apps/user
RUN npx prisma generate

# Set working directory back and add user
WORKDIR /usr/src/app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs
EXPOSE 8003
CMD ["node", "dist/apps/user/main.js"]