# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Required for building native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN apk add --no-cache python3 make g++ curl

# Pin bore version: /releases/latest/download/ only works if the filename exists on the latest tag.
RUN curl -fL https://github.com/ekzhang/bore/releases/download/v0.6.0/bore-v0.6.0-x86_64-unknown-linux-musl.tar.gz \
    -o /tmp/bore.tar.gz && \
    tar xzf /tmp/bore.tar.gz -C /usr/local/bin/ && \
    rm /tmp/bore.tar.gz

WORKDIR /app

# Only production deps (rebuild native modules for runtime arch)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Data volume mount point for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
