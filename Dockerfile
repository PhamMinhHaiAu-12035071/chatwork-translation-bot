# Stage 1: Builder
FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

# Copy workspace config files
COPY package.json bun.lockb* ./
COPY tsconfig.base.json ./

# Copy packages
COPY packages/core/package.json ./packages/core/
COPY packages/translator/package.json ./packages/translator/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY packages/core/src ./packages/core/src
COPY packages/translator/src ./packages/translator/src

# Build the translator
RUN bun build packages/translator/src/index.ts \
    --outfile dist/server.js \
    --target bun \
    --minify

# Stage 2: Runtime (distroless)
FROM oven/bun:1.1-distroless AS runtime

WORKDIR /app

COPY --from=builder /app/dist/server.js ./server.js

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "server.js"]
