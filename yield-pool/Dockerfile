FROM oven/bun:1.1.34

WORKDIR /app

COPY bun.lock package.json ./

RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./tsconfig.json
COPY src ./src
COPY scripts ./scripts
COPY README.md ./README.md

ENV NODE_ENV=production

EXPOSE 8787

CMD ["bun", "run", "start"]
