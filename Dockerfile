# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only package.json — NOT package-lock.json.
# package-lock.json generated on Windows/Mac omits linux-musl optional deps
# (e.g. @rollup/rollup-linux-x64-musl), causing Vite build failures in Alpine.
# npm install resolves the correct platform deps from scratch.
COPY package.json ./
RUN npm install --include=dev

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# curl for healthcheck; bore for optional tunnel
RUN apk add --no-cache curl

# Pin bore version
RUN curl -fL https://github.com/ekzhang/bore/releases/download/v0.6.0/bore-v0.6.0-x86_64-unknown-linux-musl.tar.gz \
    -o /tmp/bore.tar.gz && \
    tar xzf /tmp/bore.tar.gz -C /usr/local/bin/ && \
    rm /tmp/bore.tar.gz

WORKDIR /app

# Production deps only (pg is pure JS — no native compilation)
COPY package.json ./
RUN npm install --omit=dev

# Copy built artifacts
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
