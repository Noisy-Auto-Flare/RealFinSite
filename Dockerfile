# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache python3 build-base
COPY package.json package-lock.json* ./
RUN npm ci --only=production
RUN apk del python3 build-base

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN apk add --no-cache curl python3 py3-pip build-base python3-dev pkgconfig m4 && \
    pip3 install --break-system-packages beancount fava supervisor && \
    apk del build-base python3-dev pkgconfig m4 && \
    mkdir -p /data /logs /backups && \
    chown nextjs:nodejs /data /logs /backups

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY supervisord.conf /app/supervisord.conf

USER nextjs

EXPOSE 3000 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["supervisord", "-c", "/app/supervisord.conf"]
