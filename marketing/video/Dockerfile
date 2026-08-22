# Remotion Studio in a container.
#
# WHAT THIS IS FOR: one command to get the motion editor up, on any machine,
# without a matching Node on the host. Studio binds every interface, so with the
# laptop on Tailscale you can open the timeline from your phone's browser and
# retime scenes there.
#
# WHAT IT IS NOT: a way to run Remotion ON a phone. Rendering needs a headless
# Chromium, and there is no dependable one for Android/Termux. The phone is the
# screen; the laptop is the engine.
#
# node:20-slim (bookworm) rather than alpine: Remotion's headless shell is
# glibc-linked and will not run against musl.
FROM node:20-slim

# Runtime libraries Chromium needs. Remotion downloads the headless shell itself
# on first render; these are the shared objects it links against. Without them a
# render dies with a bare "cannot open shared object file" and no other clue.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
      libcairo2 libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libnspr4 \
      libnss3 libpango-1.0-0 libx11-6 libxcomposite1 libxdamage1 libxext6 \
      libxfixes3 libxkbcommon0 libxrandr2 xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies as their own layer, so editing a scene does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Studio's default. Compose maps it; override with --port if it collides.
EXPOSE 3000

# --disable-keyboard-shortcuts is deliberately NOT set: the shortcuts are half of
# why the Studio is a usable editor.
CMD ["npx", "remotion", "studio", "--port", "3000"]
