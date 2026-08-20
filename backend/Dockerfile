# SB-0049 — 3.14, matching the venv every test run uses and the version
# CLAUDE.md names. Production ran 3.11 while the 1343-test suite ran 3.14, so
# three minor versions of behaviour difference sat between "tests pass" and
# "it works in production" — the gap where a passing suite stops being evidence.
# Every dependency is pinned (requirements.txt) and demonstrably runs on 3.14.
FROM python:3.14-slim

WORKDIR /app

# Install system dependencies required by psycopg2-binary and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

EXPOSE 8000

# --forwarded-allow-ips is pinned rather than left to uvicorn's implicit
# 127.0.0.1 default (SB-0011). The app derives the caller from the raw
# X-Forwarded-For itself — see app/services/client_ip.py — so this only
# governs whether uvicorn additionally rewrites scope["client"]. Set
# FORWARDED_ALLOW_IPS to the real proxy CIDR to opt back in.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --forwarded-allow-ips \"${FORWARDED_ALLOW_IPS:-}\""]
