FROM oven/bun:1.1.38-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src/ src/
COPY .env.example .env

RUN bun build src/index.ts --outdir dist --target bun

FROM oven/bun:1.1.38-alpine

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=builder /app/dist/ dist/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/.env.example .env

ENV PORT=8787
ENV NODE_ENV=production

EXPOSE $PORT

CMD ["bun", "dist/index.js"]
