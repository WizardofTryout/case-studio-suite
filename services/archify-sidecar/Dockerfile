# ==============================================================================
# Multi-stage Dockerfile for Archify Headless Sidecar
# Base: Node 20 Alpine (deterministisch, isoliert, schlank)
# ==============================================================================

# Build Stage: Git clone & Dependency resolution
FROM node:20-alpine AS builder

ARG ARCHIFY_REPO=https://github.com/WizardofTryout/archify.git
ARG ARCHIFY_REF=73aaa0696e8f72c232ea710e6fa94fd953f3e773

WORKDIR /build

RUN apk add --no-cache git

# Klone den spezifischen Commit des Forks
RUN git clone ${ARCHIFY_REPO} repo && \
    cd repo && \
    git checkout ${ARCHIFY_REF} && \
    VERIFIED_HASH=$(git rev-parse HEAD) && \
    if [ "$VERIFIED_HASH" != "$ARCHIFY_REF" ]; then \
        echo "FEHLER: Commit-Hash stimmt nicht überein ($VERIFIED_HASH vs $ARCHIFY_REF)"; exit 1; \
    fi && \
    # Kopiere nur den archify-Unterordner und entferne .git
    mkdir -p /build/archify && \
    cp -r archify/* /build/archify/ && \
    rm -rf /build/repo

# Installiere Produktiv-Abhängigkeiten von Archify
WORKDIR /build/archify
RUN npm ci --omit=dev

# ------------------------------------------------------------------------------
# Production Runner Stage
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Erstelle non-root User für erhöhte Sicherheit
RUN addgroup -S archify && adduser -S archify -G archify

# Kopiere die vorbereitete Archify-Codebasis
COPY --from=builder /build/archify /app/archify

# Kopiere und installiere den Sidecar-Server
COPY package.json /app/
RUN npm install --omit=dev

COPY server.js /app/

# Temp-Verzeichnis für Render-Prozesse
RUN mkdir -p /tmp/archify-render && chown -R archify:archify /tmp/archify-render /app

USER archify

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

CMD ["node", "server.js"]
