# Flask Backend Environment Variables
# Copy this file to root directory (same directory as the docker-compose.yml) and fill in your actual values
# NEVER commit .env to version control
#
# For detailed setup instructions, see:
# - docs/dev-guidelines/PRODUCTION_DEPLOYMENT.md (Step 1: Generate Secret Keys)
# - Root docker-compose.yml (for Docker deployment configuration)
# - flask_backend/README.md (for local development setup)

# ============================================================================
# Flask Configuration
# ============================================================================
# See: docs/dev-guidelines/PRODUCTION_DEPLOYMENT.md - Section "Step 1: Generate Secret Keys"
FLASK_ENV=production

# Generate strong random keys using:
# python3 -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY=generate-a-strong-random-secret-key-here
JWT_SECRET_KEY=generate-a-strong-random-jwt-secret-here

# ============================================================================
# Database Configuration
# ============================================================================
# See: docs/dev-guidelines/PRODUCTION_DEPLOYMENT.md - Section "Required Environment Variables"
# See: docs/schema/database-schema.md (for database schema details)
#
# The app uses SQLAlchemy ORM, so you can use any supported database:
# - SQLite (local development): sqlite:///instance/app.sqlite
# - PostgreSQL (recommended for production): postgresql://user:pass@host:5432/dbname
# - MySQL: mysql://user:pass@host:3306/dbname
# - MariaDB: mysql+pymysql://user:pass@host:3306/dbname
# - Other SQLAlchemy-supported databases

# For local development (SQLite):
# DATABASE_URL=sqlite:///instance/app.sqlite

# For Docker Compose / Production (PostgreSQL):
# See: docker-compose.yml (postgres service configuration)
DATABASE_URL=postgresql://username:password@hostname:5432/database_name

# If using docker-compose, these variables configure the PostgreSQL container:
# See: docker-compose.yml - postgres service environment section
POSTGRES_DB=peereval
POSTGRES_USER=peereval_user
POSTGRES_PASSWORD=dev_password_change_in_prod

# ============================================================================
# CORS Configuration
# ============================================================================
# See: docs/dev-guidelines/PRODUCTION_DEPLOYMENT.md - Section "CORS Configuration"
# Comma-separated list of allowed frontend origins
# Must match your frontend URL(s) exactly (include protocol and port)
CORS_ORIGINS=http://localhost:3000,http://localhost:80,http://localhost:5173,https://your-frontend-domain.com

# ============================================================================
# JWT Cookie Configuration
# ============================================================================
# See: docs/dev-guidelines/PRODUCTION_DEPLOYMENT.md - Section "How Production Mode Affects JWT Settings"
#
# Optional: Set for production cross-subdomain authentication
# Example: .yourdomain.com (allows cookies across api.yourdomain.com and app.yourdomain.com)
# Leave empty for single-domain deployments
JWT_COOKIE_DOMAIN=

# ============================================================================
# Gunicorn Configuration (Production)
# ============================================================================
# See: flask_backend/Dockerfile (CMD section for gunicorn usage)
# See: docs/dev-guidelines/PRODUCTION_DEPLOYMENT.md - Troubleshooting section
#
# Number of worker processes (2-4 x NUM_CPU_CORES)
GUNICORN_WORKERS=2

# Number of threads per worker
GUNICORN_THREADS=2

# ============================================================================
# Optional: Production Settings
# ============================================================================
# See: docs/dev-guidelines/PRODUCTION_DEPLOYMENT.md - Section "Critical Security Requirements"
# Set to true to enable production mode (alternative to FLASK_ENV=production)
PRODUCTION=true

# Default admin bootstrap (used by flask ensure_admin)
# Update to real credentials before deploying
DEFAULT_ADMIN_NAME="Example Admin"
DEFAULT_ADMIN_EMAIL="admin@example.com"
DEFAULT_ADMIN_PASSWORD="ChangeMe123!"