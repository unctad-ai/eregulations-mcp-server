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

# Install production dependencies only
RUN npm ci --omit=dev

ENV PORT=${PORT}
ENV STDIO_CMD=${STDIO_CMD}
ENV BASE_URL=${BASE_URL}
ENV SSE_PATH=${SSE_PATH}
ENV MESSAGE_PATH=${MESSAGE_PATH}
ENV HEALTH_ENDPOINT=${HEALTH_ENDPOINT}
ENV LOG_LEVEL=${LOG_LEVEL}
ENV CORS_ENABLED=${CORS_ENABLED}

# Expose the port
EXPOSE ${PORT}

# Command to run the server - use shell form to allow variable interpolation
CMD node dist/sse.js --stdio="$STDIO_CMD" --port="$PORT" --baseUrl="$BASE_URL" --ssePath="$SSE_PATH" --messagePath="$MESSAGE_PATH" --healthEndpoint="$HEALTH_ENDPOINT" --logLevel="$LOG_LEVEL" --corsEnabled="$CORS_ENABLED"