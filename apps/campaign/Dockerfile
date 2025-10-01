# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.20.0

FROM node:${NODE_VERSION}-slim AS build
WORKDIR /usr/src/app
COPY package*.json ./
COPY apps/campaign/package*.json ./apps/campaign/
RUN npm ci
COPY . .
RUN cd apps/campaign && npx prisma generate
RUN npm run build:campaign

FROM node:${NODE_VERSION}-alpine AS production
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/apps/campaign/package*.json ./apps/campaign/
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/apps/campaign/prisma ./apps/campaign/prisma
COPY --from=build /usr/src/app/libs/grpc/proto ./libs/grpc/proto

WORKDIR /usr/src/app/apps/campaign
RUN npx prisma generate

WORKDIR /usr/src/app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs
EXPOSE 8004
CMD ["node", "dist/apps/campaign/main.js"]