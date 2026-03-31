# Use specific Bun version for reproducibility (not latest)
FROM oven/bun:1.1.38 AS deps

# Install Bun dependencies on a lean base image so this layer does not inherit
# the large Chromium/Xvfb filesystem and become slow to snapshot.
WORKDIR /app

# Copy package files first (better caching - only reinstall if these change)
COPY package.json bun.lock* ./

# Install dependencies (cached if package.json unchanged)
RUN bun install --frozen-lockfile

FROM oven/bun:1.1.38 AS runtime

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

# Create non-root user for security
# Also create X11 directory to suppress Xvfb warning
RUN groupadd -r bunuser && useradd -r -g bunuser bunuser \
    && mkdir -p /tmp/.X11-unix \
    && chmod 1777 /tmp/.X11-unix \
    && chown root:root /tmp/.X11-unix

COPY --from=deps --chown=bunuser:bunuser /app/package.json ./package.json
COPY --from=deps --chown=bunuser:bunuser /app/node_modules ./node_modules

# Copy source code (this layer changes more frequently)
COPY --chown=bunuser:bunuser . .

USER bunuser

# Health check (verify Bun is working)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

# Set display for Xvfb
ENV DISPLAY=:99

# Start Xvfb and run script
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x24 & bun run src/index.ts"]
