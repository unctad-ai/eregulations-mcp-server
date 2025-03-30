FROM node:20-alpine AS builder

# Add build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    sqlite \
    sqlite-dev

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Copy all source files before installing dependencies
# This ensures TypeScript can find the source files
COPY . .

# Install dependencies with scripts for proper native module compilation
RUN npm ci

# Build the application
RUN npm run build

FROM node:20-alpine AS release

# Add runtime dependencies
RUN apk add --no-cache sqlite sqlite-dev python3 make g++

WORKDIR /app

# Copy package files for reinstalling dependencies
COPY package*.json ./

# Install production dependencies
# Note: Do NOT use --ignore-scripts here as it's needed for better-sqlite3
RUN npm ci --omit=dev --ignore-scripts && \
    # Manually rebuild better-sqlite3 for the correct architecture
    cd node_modules/better-sqlite3 && \
    npm run install

# Copy built application and other necessary files
COPY --from=builder /app/dist ./dist

# Create data directory and ensure it persists
VOLUME /app/data/cache
RUN mkdir -p /app/data/cache && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Set production environment
ENV NODE_ENV=production \
    LOG_LEVEL=info

# Run in STDIO mode
CMD ["node", "dist/index.js"]