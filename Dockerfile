# syntax=docker/dockerfile:1.6
# -----------------------------------------------------------------------------
# Multi-stage production image for the WebRTC signaling + trainer studio.
# Optimized for Python 3.11 with PyAV / aiortc FFmpeg system libraries.
# -----------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Stage 1 — build wheels (compile av / aiortc against FFmpeg headers)
# ---------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# Build toolchain + FFmpeg / libs needed to compile PyAV and aiortc deps
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        pkg-config \
        git \
        # FFmpeg / libav (PyAV)
        libavformat-dev \
        libavcodec-dev \
        libavdevice-dev \
        libavutil-dev \
        libavfilter-dev \
        libswscale-dev \
        libswresample-dev \
        # aiortc / WebRTC media
        libopus-dev \
        libvpx-dev \
        libsrtp2-dev \
        libffi-dev \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.txt .

# Build all deps into a relocatable prefix (no system site-packages pollution)
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip setuptools wheel \
    && /opt/venv/bin/pip install -r requirements.txt

# ---------------------------------------------------------------------------
# Stage 2 — slim runtime
# ---------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    # App defaults (override via compose / k8s / .env)
    VIDEO_PROVIDER=mock \
    LLM_PROVIDER=mock \
    RUNPOD_FALLBACK_TO_MOCK=true \
    PORT=8000 \
    HOST=0.0.0.0

# Runtime shared libraries only (no compilers / -dev packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
        # FFmpeg / libav runtime (PyAV)
        libavformat59 \
        libavcodec59 \
        libavdevice59 \
        libavutil57 \
        libavfilter8 \
        libswscale6 \
        libswresample4 \
        # codec helpers often required by libav
        libopus0 \
        libvpx7 \
        libsrtp2-1 \
        # healthcheck
        curl \
        ca-certificates \
        # aiortc may need these at runtime
        libffi8 \
        libssl3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser

# Virtualenv from builder
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app

# Application code + smoke scripts
COPY app ./app
COPY scripts ./scripts
COPY requirements.txt ./requirements.txt

# Persistent data dirs (datasets / weight index) — mounted as volumes in compose
RUN mkdir -p /app/data/trainer/datasets /app/data/trainer/weights \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-8000}/health" || exit 1

# Static files served by FastAPI (app/static); no separate nginx required for MVP
CMD ["sh", "-c", "exec uvicorn app.main:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
