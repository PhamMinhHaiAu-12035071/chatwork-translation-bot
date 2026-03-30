FROM oven/bun:latest

# Install system dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    xvfb \
    fonts-liberation \
    fonts-noto-color-emoji \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install Node dependencies
RUN bun install --frozen-lockfile

# Copy application code
COPY . .

# Set display for Xvfb (puppeteer-real-browser will auto-start Xvfb)
ENV DISPLAY=:99

# Run script
CMD ["bun", "run", "src/index.ts"]
