# ---- Build Stage ----
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# ---- Run Stage ----
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port (Google Cloud Run will override this if needed)
EXPOSE 8080

# Note: Google Cloud Run handles health checks automatically via the /health endpoint
# No need for Docker HEALTHCHECK as Cloud Run will probe the container

# Start the application
CMD ["node", "dist/index.js"]
