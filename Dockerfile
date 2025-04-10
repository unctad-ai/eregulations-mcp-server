# Stage 1: Builder
FROM node:23-alpine AS builder

# Add build dependencies - REMOVED python3, make, g++
# RUN apk add --no-cache \
#     python3 \
#     make \
#     g++

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Copy all source files before installing dependencies (respects .dockerignore)
COPY . .

# Install dependencies with scripts for proper native module compilation
RUN npm ci

# Build the application
RUN npm run build

# Stage 2: Release
FROM node:23-alpine AS release

# Add runtime dependencies - NONE needed beyond base node:alpine
# RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files for reinstalling dependencies
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev --ignore-scripts

# Copy built application and other necessary files
COPY --from=builder /app/dist ./dist

RUN chown -R node:node /app

# Switch to non-root user
USER node

# Set production environment
ENV NODE_ENV=production \
    LOG_LEVEL=info

# Run in STDIO mode
CMD ["node", "dist/index.js"]