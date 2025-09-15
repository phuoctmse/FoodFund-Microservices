# Production stage (single stage for simplicity)
FROM node:20-alpine AS production

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma
COPY apps/user/package*.json ./apps/user/
COPY apps/user/prisma ./apps/user/prisma

# Install all dependencies (including dev dependencies for Prisma)
RUN npm ci

# Copy source code (protected by .dockerignore)
COPY . .


# Generate Prisma client
RUN npx prisma generate --schema=apps/user/prisma/schema.prisma

# Build application
RUN npm run build --workspace=user

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


# Health check (optional, nếu có healthcheck.js thì giữ lại, nếu không thì xóa)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 
#   CMD node healthcheck.js

# Start the application
CMD ["node", "dist/apps/user/main"]
