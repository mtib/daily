FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun build src/index.ts --outfile dist/server.js --target bun

FROM oven/bun:1
WORKDIR /app
COPY --from=builder /app/dist/server.js .
RUN mkdir -p /app/data
EXPOSE 3001
CMD ["bun", "server.js"]
