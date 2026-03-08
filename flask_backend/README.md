# Peer Evaluation App — Flask Backend

This is the Flask REST API backend for the Peer Evaluation App, built using the MVC architecture with Flask, SQLAlchemy, and Marshmallow for serialization.

## Features

- RESTful API with JWT authentication
- Role-based authorization (Student, Teacher, Admin)
- SQLAlchemy ORM with SQLite (dev) or PostgreSQL (production)
- Marshmallow schemas for request/response validation
- Flask blueprints for modular routing
- CLI commands for database management

## Prerequisites

### Installing Python

#### Windows

1. Download Python 3.8+ from [python.org](https://www.python.org/downloads/)
2. Run the installer and **check "Add Python to PATH"**
3. Verify installation:

   ```powershell
   python --version
   pip --version
   ```

#### macOS

Option 1 - Official Installer:

1. Download Python from [python.org](https://www.python.org/downloads/)
2. Run the `.pkg` installer

Option 2 - Homebrew (recommended):

```bash
brew install python3
```

Verify installation:

```bash
python3 --version
pip3 --version
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
python3 --version
pip3 --version
```

#### Linux (Fedora/RHEL)

```bash
sudo dnf install python3 python3-pip
python3 --version
pip3 --version
```

## Local Development Setup

### Windows (PowerShell)

1. **Navigate to the backend directory:**

   ```powershell
   cd flask_backend
   ```

2. **Create a virtual environment:**

   ```powershell
   python -m venv venv
   ```

3. **Activate the virtual environment:**

   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

   *Note: If you get an execution policy error, run:*

   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

4. **Install the package and dependencies:**

   ```powershell
   pip install -e .
   pip install -r requirements-dev.txt
   ```

5. **Set the environment variable:**

   ```powershell
   $env:FLASK_APP = "api"
   ```

   *Optional:* run `setx FLASK_APP "api"` if you want a persistent value outside the current PowerShell session.

6. **Initialize the database:**

   ```powershell
   flask init_db
   ```

7. **Add sample users:**

   ```powershell
   flask add_users
   ```

8. **Add sample courses and assignments:**

   ```powershell
   flask add_sample_courses
   ```

   Or create just an admin:

   ```powershell
   flask create_admin
   ```

9. **Run the development server:**

   ```powershell
   flask run
   ```

The API will be available at [http://localhost:5000](http://localhost:5000)

### macOS/Linux (Bash)

1. **Navigate to the backend directory:**

   ```bash
   cd flask_backend
   ```

2. **Create a virtual environment:**

   ```bash
   python3 -m venv venv
   ```

3. **Activate the virtual environment:**

   ```bash
   source venv/bin/activate
   ```

4. **Install the package and dependencies:**

   ```bash
   pip install -e .
   pip install -r requirements-dev.txt
   ```

5. **Set the environment variable:**

   ```bash
   export FLASK_APP=api
   ```

6. **Initialize the database:**

   ```bash
   flask init_db
   ```

7. **Add sample users:**

   ```bash
   flask add_users
   ```
8. **Add sample courses and assignments:**

   ```powershell
   flask add_sample_courses
   ```

   Or create just an admin:

   ```bash
   flask create_admin
   ```

9. **Run the development server:**

   ```bash
   flask run
   ```

The API will be available at [http://localhost:5000](http://localhost:5000)

---

## Environment Variables (Local Development)

### Quick Start (No Configuration Needed)

For local development, the app works out-of-the-box with sensible defaults. **You don't need to create a `.env` file** unless you want to customize behavior.

### Optional Configuration

If you want to customize settings, create a `.env` file in the `flask_backend/` directory:

```bash
# Example .env file for local development (all optional)

# Secret Keys (defaults are generated if not set)
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here

# Database (default: SQLite at instance/app.sqlite)
DATABASE_URL=sqlite:///instance/app.sqlite

# JWT Configuration (defaults shown)
JWT_ACCESS_TOKEN_EXPIRES=3600  # seconds (1 hour)
JWT_COOKIE_SECURE=false        # true only in production
JWT_COOKIE_SAMESITE=Lax        # Strict in production

# CORS (default: localhost:3000)
CORS_ORIGINS=http://localhost:3000

# Flask Debug (default: true in development)
FLASK_DEBUG=true
```

### Environment Variables Explained

| Variable | Required? | Default (Dev) | Purpose |
|----------|-----------|---------------|---------|
| `SECRET_KEY` | Optional | Auto-generated | Flask session encryption |
| `JWT_SECRET_KEY` | Optional | Auto-generated | JWT token signing key |
| `DATABASE_URL` | Optional | `sqlite:///instance/app.sqlite` | Database connection string |
| `JWT_ACCESS_TOKEN_EXPIRES` | Optional | `3600` (1 hour) | Token lifetime in seconds |
| `JWT_COOKIE_SECURE` | Optional | `false` | Require HTTPS for cookies (true in production) |
| `JWT_COOKIE_SAMESITE` | Optional | `Lax` | Cookie SameSite policy |
| `CORS_ORIGINS` | Optional | `http://localhost:3000` | Allowed frontend origins |
| `FLASK_DEBUG` | Optional | `true` | Enable debug mode |

### Production vs Development

The app automatically detects production mode when `FLASK_ENV=production` or `PRODUCTION=true` and enforces secure settings:

| Setting | Development | Production |
|---------|-------------|------------|
| Secret Keys | Auto-generated (fine for dev) | **Must be set** (app crashes if missing) |
| `JWT_COOKIE_SECURE` | `false` | `true` (HTTPS required) |
| `JWT_COOKIE_SAMESITE` | `Lax` | `Strict` |
| `JWT_COOKIE_CSRF_PROTECT` | `false` | `true` |
| Database | SQLite | **PostgreSQL required** |

**For production deployment:** See [docs/dev-guidelines/PRODUCTION_DEPLOYMENT.md](../docs/dev-guidelines/PRODUCTION_DEPLOYMENT.md)

### Generating Secure Keys (Production)

For production, generate cryptographically secure keys:

```bash
# Generate SECRET_KEY
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"

# Generate JWT_SECRET_KEY  
python3 -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(32))"
```

**Never commit these keys to git!**

---

## Available CLI Commands

The Flask backend includes several CLI commands for database management:

- `flask init_db` - Initialize/reset the database schema
- `flask add_users` - Add sample users (admin, teacher, student)
- `flask add_sample_courses` - Add sample courses and assignments
- `flask create_admin` - Create a single admin user interactively
- `flask drop_db` - Drop all database tables

## Default Test Users

After running `flask add_users`, the following accounts are available:

### Original Example Users

| Role    | Email                 | Password   |
|---------|-----------------------|------------|
| Admin   | admin@example.com     | 123456     |
| Teacher | teacher@example.com   | 123456     |
| Student | student@example.com   | 123456     |

### Peer Review Test Users (with complete test scenario)

| Role    | Email                 | Password   | Notes |
|---------|-----------------------|------------|-------|
| Teacher | teacher@test.com      | 123456     | Can view all reviews via `/review/assignment/<id>/all` |
| Student | student1@test.com     | 123456     | Has 2 incomplete reviews assigned |
| Student | student2@test.com     | 123456     | Has 1 incomplete, 1 complete review |
| Student | student3@test.com     | 123456     | Has 1 complete review |
| Student | student4@test.com     | 123456     | Has 1 complete review |

**Peer Review Setup:**
- 1 course: "Introduction to Peer Review"
- 1 assignment: "Essay Peer Review Assignment" with rubric (5 criteria)
- 6 total reviews assigned (4 completed, 2 incomplete)
- 3 submissions from students 2, 3, and 4

**Review Matrix:**
- Student 1 → Student 2 (✅ Completed with high scores)
- Student 1 → Student 3 (⏳ Incomplete)
- Student 2 → Student 3 (✅ Completed with medium scores)
- Student 2 → Student 4 (⏳ Incomplete)
- Student 3 → Student 4 (✅ Completed)
- Student 4 → Student 1 (✅ Completed)

This provides a realistic test scenario for:
- Students completing peer reviews
- Teachers monitoring review progress
- Testing the new teacher review overview endpoint

## Running Tests

The test suite uses pytest with an in-memory SQLite database. No external services are required.

### Windows (PowerShell)

```powershell
# Make sure you're in flask_backend and venv is activated
.\venv\Scripts\Activate.ps1

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run a specific test file
pytest tests/test_login.py

# Run a specific test function
pytest tests/test_login.py::test_login

# Stop on first failure
pytest -x

# Run with coverage report
pytest --cov=api --cov-report=html
```

### macOS/Linux

```bash
# Make sure you're in flask_backend and venv is activated
source venv/bin/activate

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run a specific test file
pytest tests/test_login.py

# Run a specific test function
pytest tests/test_login.py::test_login

# Stop on first failure
pytest -x

# Run with coverage report
pytest --cov=api --cov-report=html
```

## Project Structure

```text
flask_backend/
├── api/
│   ├── __init__.py           # Flask app factory
│   ├── config.py             # Configuration settings
│   ├── cli/
│   │   └── database.py       # CLI commands
│   ├── controllers/          # Route handlers (blueprints)
│   │   ├── auth_controller.py
│   │   └── user_controller.py
│   └── models/               # Database models & schemas
│       ├── db.py             # SQLAlchemy instance
│       └── user_model.py     # User model & schema
├── tests/                    # Test suite
│   ├── conftest.py           # Pytest fixtures
│   ├── test_login.py
│   └── test_user.py
├── instance/                 # Database files (gitignored)
├── requirements-dev.txt      # Development dependencies
└── setup.py                  # Package configuration
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and receive JWT token

### User Management
- `GET /user/profile` - Get current user profile (requires JWT)
- `GET /user/all` - List all users (admin only)

### Peer Reviews (NEW)
- `GET /review/assigned/<assignment_id>` - Get reviews assigned to current user
- `GET /review/submission/<review_id>` - Get submission for a review
- `POST /review/submit/<review_id>` - Submit peer review feedback
- `GET /review/status/<assignment_id>` - Get review completion status
- `POST /review/create` - Create review assignment (teacher/admin)
- `GET /review/<review_id>` - Get review details with criteria
- `GET /review/criteria/<assignment_id>` - Get rubric criteria for assignment
- **`GET /review/assignment/<assignment_id>/all`** - Get all reviews for assignment (teacher/admin) **NEW**

See [docs/dev-guidelines/ENDPOINT_SUMMARY.md](../docs/dev-guidelines/ENDPOINT_SUMMARY.md) for complete API documentation.
See [docs/TEACHER_REVIEW_OVERVIEW.md](../docs/TEACHER_REVIEW_OVERVIEW.md) for details on the teacher review overview feature.

## Configuration

The Flask app uses the following default configuration:
- **Database**: SQLite (`instance/peer_eval.db`)
- **JWT Secret**: Auto-generated (or set via `JWT_SECRET_KEY` env var)
- **Debug Mode**: Enabled for development

To override defaults, create `api/config.py` or set environment variables:

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL="postgresql://user:pass@localhost/dbname"
$env:JWT_SECRET_KEY="your-secret-key"
flask run
```

**macOS/Linux:**
```bash
export DATABASE_URL="postgresql://user:pass@localhost/dbname"
export JWT_SECRET_KEY="your-secret-key"
flask run
```

## Troubleshooting

### Virtual Environment Activation Issues (Windows)

If you get a "cannot be loaded because running scripts is disabled" error:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Port Already in Use

If port 5000 is already in use:

**Windows:**
```powershell
$env:FLASK_RUN_PORT="5001"
flask run
```

**macOS/Linux:**
```bash
export FLASK_RUN_PORT=5001
flask run
```

### Database Locked Error

If you see "database is locked" errors, ensure no other Flask instance is running and try:
```bash
flask drop_db
flask init_db
flask add_users
```

## Development Workflow

1. **Activate virtual environment** (every time you open a new terminal)
2. **Make code changes**
3. **Run tests**: `pytest`
4. **Test manually** using the frontend or tools like Postman/curl
5. **Deactivate** when done: `deactivate`

## Next Steps

- See [../docs/ROLE_QUICK_REFERENCE.md](../docs/ROLE_QUICK_REFERENCE.md) for API usage examples
- See [../frontend/README.md](../frontend/README.md) to set up the frontend

Coverage plugin (`pytest-cov`) is installed via `requirements-dev.txt`. Run:

```bash
pytest --cov=api --cov-report=term-missing
```

### Notes

- Tests bootstrap the app via `api.create_app` with `TESTING=True` and create/drop tables per session; your local database will not be modified.
- CI-oriented dependencies live in `requirements-ci.txt`. For local development, prefer `requirements-dev.txt`.

## The structure of the project (In the following tree, only important entities are listed)

```text
├── api
│   ├── cli
│   ├── controllers
│   ├── models
│   ├── __init__.py
│   ├── config.py
├── tests
├── .gitignore
├── setup.py
├── requirements-dev.txt

```

In the current directory, you can find the files required to install the project, such as `requirements-dev.txt`, `setup.py`, etc., as well as two directories: `tests` and `api`. The tests directory is a package designed to implement test-driven development. You can use the examples in this package to implement your own tests. The main Flask application is implemented inside the api package. The structure of the api package is as follows:

```text
├── api
│   ├── cli
│   ├── controllers
│   ├── models
│   ├── __init__.py
│   ├── config.py
```

Inside the `__init__.py` file, the Flask application is configured. In this file, you need to import and register your controllers (routes).

# Tutorial for extension

## Let’s Add a New Controller to This Project

Inside the controllers package, create a new file, such as test.py, at api/controllers/test.py.

Now paste the following code into this file:

```python
from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for,
    jsonify
)


test = Blueprint('test', __name__)


@test.route('/test', methods=('POST', 'GET'))
def get_scanner():
    if request.method == 'GET':
        return jsonify(
            [
              {
                "test": True
              }
            ]
        ), 200
```

then, go to the `api/__init__.py` and import `test_api`.

```python
from .controllers import auth, member, fake_api, test_api
```

**Note: The import already exists; you only need to import test_api.**

Register the controller inside the create_app function after init_app(app).

```python
app.register_blueprint(test_api.test)
```

**Note: check the auth.py file inside the `controllers` package to see how we can implement authentication**

## Let’s Add a New model to This Project

Make a new file name `example_model.py` inside the `api/models` package.
paste the following code inside this file:

```python
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship


from .db import Base, session, ma


class Example(Base):
    __tablename__ = 'examples'

    id = Column(Integer, primary_key=True)
    name = Column(String)

    def __init__(self, name):

        self.name = name

class ExampleSchema(ma.Schema):


    class Meta:
        fields = (
            "id",
            "name"
        )
```

Now, inside `models/__init__.py` import this new model.

```python
from .example_model import Example
```

Destroy the previous database (if you are using SQLite, then just remove the file) and run

```bash
flask init_db
```
