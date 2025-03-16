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

FROM node:20-alpine AS release

WORKDIR /app

# Copy package files and build artifacts
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

# Install production dependencies only
RUN npm ci --omit=dev

# Environment variables
ENV NODE_ENV=production
ENV PORT=7000

# Expose the port
EXPOSE ${PORT}

# Command to run the server
CMD ["node", "dist/sse.js"]