# Use specific Alpine version for smaller size
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies and clean cache
RUN npm ci --only=production && \
    npm cache clean --force

# Production stage
FROM node:20-alpine

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs server.js .

# Create necessary directories and set permissions
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})" || exit 1

# Start the application
CMD ["node", "server.js"]