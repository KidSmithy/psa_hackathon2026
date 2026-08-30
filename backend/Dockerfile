FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr so logs and SSE events stream immediately
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

WORKDIR /app

# Install system utilities and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Cloud Run defaults to port 8080 (or respects the PORT env var injected by Cloud Run)
EXPOSE 8080

# Run uvicorn server binding to 0.0.0.0
CMD exec uvicorn agent.server:app --host 0.0.0.0 --port ${PORT:-8080}
