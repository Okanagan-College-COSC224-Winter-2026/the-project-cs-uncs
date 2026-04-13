# Multi-stage Dockerfile for Flask Backend (Production-Ready)
# Follows security best practices from PRODUCTION_DEPLOYMENT.md

# ============================================================================
# Stage 1: Builder - Install dependencies
# ============================================================================
FROM python:3.10-slim AS builder

# Install system dependencies needed for PostgreSQL and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency files
COPY setup.py requirements-ci.txt ./

# Install Python dependencies in a virtual environment
# This allows us to copy only the venv to the final stage, keeping image small
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install production dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e . && \
    pip install --no-cache-dir -r requirements-ci.txt && \
    pip install --no-cache-dir gunicorn psycopg2-binary

# ============================================================================
# Stage 2: Runtime - Minimal production image
# ============================================================================
FROM python:3.10-slim

# Install runtime dependencies only (PostgreSQL client libraries)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r flask && useradd -r -g flask flask

# Set working directory
WORKDIR /app

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv

# Copy application code
COPY api/ /app/api/
COPY run_gunicorn.sh /app/run_gunicorn.sh

# Ensure entrypoint script is executable
RUN sed -i 's/\r$//' /app/run_gunicorn.sh && chmod +x /app/run_gunicorn.sh

# Set ownership to non-root user
RUN chown -R flask:flask /app

# Switch to non-root user
USER flask

# Activate virtual environment
ENV PATH="/opt/venv/bin:$PATH"

# Set Python to run in unbuffered mode for better logging
ENV PYTHONUNBUFFERED=1

# Expose port 5000 (Flask default)
EXPOSE 5000

# ============================================================================
# IMPORTANT: Secrets are NEVER baked into the image
# Required environment variables (must be provided at runtime):
#   - FLASK_ENV=production
#   - SECRET_KEY=<secure-random-key>
#   - JWT_SECRET_KEY=<secure-random-key>
#   - DATABASE_URL=postgresql://user:pass@host:port/dbname
#   - CORS_ORIGINS=https://yourdomain.com (comma-separated list)
#
# Optional environment variables:
#   - JWT_COOKIE_DOMAIN=.yourdomain.com (for subdomain cookie sharing)
#   - GUNICORN_WORKERS=4 (number of worker processes)
#   - GUNICORN_THREADS=2 (number of threads per worker)
# ============================================================================

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/hello').read()"

# Run entrypoint script that initializes the DB schema then launches Gunicorn
CMD ["/app/run_gunicorn.sh"]
