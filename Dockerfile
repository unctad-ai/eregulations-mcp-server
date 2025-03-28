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

# Install dependencies without running prepare script yet
RUN npm ci --ignore-scripts

# Copy all source files
COPY . .

# Build the application
RUN npm run build

FROM node:20-alpine AS release

# Add runtime dependencies
RUN apk add --no-cache sqlite sqlite-dev

WORKDIR /app

# Copy only necessary files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

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