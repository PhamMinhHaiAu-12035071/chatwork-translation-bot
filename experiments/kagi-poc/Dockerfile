# Playwright official image — Chromium + all system deps pre-installed
FROM mcr.microsoft.com/playwright:v1.52-jammy

# Install Bun
RUN npm install -g bun

WORKDIR /app

# Copy package manifest first for layer caching
COPY package.json ./
RUN bun install

# Install Playwright's Chromium (system deps already in base image)
RUN bunx playwright install chromium

# Copy source
COPY . .

CMD ["bun", "src/phase2-basic.ts"]
