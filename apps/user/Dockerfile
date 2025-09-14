# Production stage (single stage for simplicity)
FROM node:20-alpine AS production

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY apps/user/package*.json ./apps/user/
COPY apps/user/prisma ./apps/user/prisma

# Install all dependencies (including dev dependencies for Prisma)
RUN npm ci

# Copy source code (protected by .dockerignore)
COPY . .

# Generate Prisma client and build application
WORKDIR /usr/src/app/apps/user
RUN npx prisma generate

WORKDIR /usr/src/app
RUN npm run build user

# Clean up dev dependencies (optional, saves space)
RUN npm prune --production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /usr/src/app
USER nestjs

# Expose port
EXPOSE 8003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["node", "dist/apps/user/main"]
