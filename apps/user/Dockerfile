# Multi-stage build for production
FROM node:20-alpine AS development

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY apps/user/package*.json ./apps/user/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client for user service
WORKDIR /usr/src/app/apps/user
RUN npx prisma generate

# Back to main directory and build the application
WORKDIR /usr/src/app
RUN npm run build user

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=development /usr/src/app/dist ./dist
COPY --from=development /usr/src/app/node_modules ./node_modules
COPY --from=development /usr/src/app/apps/user/node_modules/.prisma ./apps/user/node_modules/.prisma

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
