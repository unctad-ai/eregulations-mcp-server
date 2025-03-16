FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create data directory if it doesn't exist
RUN mkdir -p /app/data/cache

FROM node:20-alpine AS release

WORKDIR /app

# Copy package files and build artifacts
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/dist ./dist

# Create data directory structure
RUN mkdir -p /app/data/cache
# If there are any specific files in the data directory, copy them here
COPY --from=builder /app/data/cache/*.sqlite /app/data/cache/ 2>/dev/null || true

# Install production dependencies only
RUN npm ci --omit=dev

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Command to run the server
CMD ["node", "dist/sse.js"]