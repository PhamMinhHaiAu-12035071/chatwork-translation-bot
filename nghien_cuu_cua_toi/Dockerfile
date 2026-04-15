# Use specific Bun version for reproducibility (not latest)
FROM oven/bun:1.1.38 AS deps

# Install Bun dependencies on a lean base image so this layer does not inherit
# the large Chromium/Xvfb filesystem and become slow to snapshot.
WORKDIR /app

# Copy package files first (better caching - only reinstall if these change)
COPY package.json bun.lock* ./

# Install dependencies (cached if package.json unchanged)
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN bun install --frozen-lockfile

FROM oven/bun:1.1.38 AS runtime

# ARM64-safe: use distro Chromium, not Google Chrome amd64 repo
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

# Headful Chromium in Docker needs a virtual display for stable automation under Xvfb.
ENV DISPLAY=:99

# Start Xvfb with realistic resolution (Full HD) and run script
# Larger resolution makes browser fingerprint more realistic (bypass Cloudflare detection)
# 1. Remove stale Chromium singleton lock files (left over from previous container runs).
#    Without cleanup, a new container (new hostname) sees the old lock as "another machine" → Chrome exits.
# 2. Wait until Xvfb socket exists before starting the app (avoids race condition on :99 display).
#
# Previous command before using a shared Xvfb container setup:
# CMD ["sh", "-c", "rm -f /app/user-data/SingletonLock /app/user-data/SingletonCookie /app/user-data/SingletonSocket && bun run src/index.ts"]

CMD ["sh", "-c", "rm -f /app/user-data/SingletonLock /app/user-data/SingletonCookie /app/user-data/SingletonSocket; Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset & until [ -S /tmp/.X11-unix/X99 ]; do sleep 1; done && bun run src/index.ts"]
