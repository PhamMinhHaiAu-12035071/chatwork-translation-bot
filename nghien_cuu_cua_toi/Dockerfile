# Use specific Bun version for reproducibility (not latest)
FROM oven/bun:1.1.38 AS base

# Install system dependencies (cached layer)
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    xvfb \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (better caching - only reinstall if these change)
COPY package.json bun.lockb* ./

# Install dependencies (cached if package.json unchanged)
RUN bun install --frozen-lockfile

# Copy source code (this layer changes more frequently)
COPY . .

# Create non-root user for security
RUN groupadd -r bunuser && useradd -r -g bunuser bunuser \
    && chown -R bunuser:bunuser /app

USER bunuser

# Health check (verify Bun is working)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

# Set display for Xvfb
ENV DISPLAY=:99

# Start Xvfb and run script
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x24 & bun run src/index.ts"]
