# Stage 1: Build do Frontend React (Vite)
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Runtime com Node 24 (SQLite nativo) + PM2
FROM node:24-alpine AS runner
WORKDIR /app

RUN npm install -g pm2

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY ecosystem.config.cjs ./ecosystem.config.cjs

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV TRUST_PROXY=true
ENV ALLOWED_IPS="2804:431:80f7:7700::/48,2804:1b3:a5e7:c3c7::/48,201.93.163.133,2804:1b3:a5e7:2c83::/48,201.93.159.169,2804:1b3:a5e7:8e38::/48,127.0.0.1,::1"

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]

