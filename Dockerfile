# Stage 1: Build dashboard
FROM oven/bun:1.3-alpine AS dashboard-builder

WORKDIR /app

COPY package.json bun.lock* ./
COPY tsconfig.base.json ./
COPY packages/dashboard/package.json packages/dashboard/
COPY packages/dashboard/tsconfig.json packages/dashboard/
COPY packages/dashboard/vite.config.ts packages/dashboard/
COPY packages/dashboard/index.html packages/dashboard/
COPY packages/dashboard/src/ packages/dashboard/src/

RUN cd packages/dashboard && bun install && bun run build

# Stage 2: Build translator
FROM oven/bun:1.3-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
COPY tsconfig.base.json ./

# All workspace package.json files (required for workspace resolution)
COPY packages/core/package.json packages/core/
COPY packages/chatwork/package.json packages/chatwork/
COPY packages/translation-prompt/package.json packages/translation-prompt/
COPY packages/provider-gemini/package.json packages/provider-gemini/
COPY packages/provider-openai/package.json packages/provider-openai/
COPY packages/provider-cursor/package.json packages/provider-cursor/
COPY packages/provider-kagi/package.json packages/provider-kagi/
COPY packages/translator/package.json packages/translator/
COPY packages/webhook-logger/package.json packages/webhook-logger/
COPY packages/dataset-runner/package.json packages/dataset-runner/
COPY packages/dashboard/package.json packages/dashboard/
COPY packages/kagi-sidecar/package.json packages/kagi-sidecar/

RUN bun install --frozen-lockfile

# tsconfig files (needed for path alias resolution in bun build)
COPY packages/translator/tsconfig.json packages/translator/
COPY packages/core/tsconfig.json packages/core/
COPY packages/chatwork/tsconfig.json packages/chatwork/
COPY packages/translation-prompt/tsconfig.json packages/translation-prompt/

# Source for all packages bundled into translator
COPY packages/core/src packages/core/src
COPY packages/chatwork/src packages/chatwork/src
COPY packages/translation-prompt/src packages/translation-prompt/src
COPY packages/provider-gemini/src packages/provider-gemini/src
COPY packages/provider-openai/src packages/provider-openai/src
COPY packages/provider-cursor/src packages/provider-cursor/src
COPY packages/provider-kagi/src packages/provider-kagi/src
COPY packages/translator/src packages/translator/src

RUN bun build packages/translator/src/index.ts \
    --outfile dist/server.js \
    --target bun \
    --minify

# Stage 3: Runtime (distroless)
FROM oven/bun:1.3-distroless AS runtime

WORKDIR /app

COPY --from=builder /app/dist/server.js ./server.js
COPY --from=dashboard-builder /app/packages/dashboard/dist ./dashboard-dist/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "server.js"]
