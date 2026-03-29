# Use Node.js base image with common build dependencies
FROM node:18-bullseye

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
  libnss3 libxss1 libasound2 \
  libatk-bridge2.0-0 libgtk-3-0 libgbm-dev libxkbcommon0 \
  && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN npm install -g bun

WORKDIR /app

# Copy package manifest first for layer caching
COPY package.json bun.lock* ./
RUN bun install

# Install Playwright's Chromium with dependencies
RUN bunx playwright install --with-deps chromium

# Copy source
COPY . .

CMD ["bun", "src/phase2-basic.ts"]
