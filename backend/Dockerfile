FROM python:3.11-slim

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
