# Testing Instructions (Lite)

- **Location:** Tests for the Flask backend live in `flask_backend/tests/test_login.py` and sibling files; test fixtures are in `flask_backend/tests/conftest.py`.
- **Purpose:** Unit and integration tests verify API controllers, models, and schemas for the Flask backend. Tests run against an in-memory SQLite DB where configured, so they are fast and isolated.
- **Prerequisites:** Python 3.x, a virtual environment, and dev requirements installed from `flask_backend/requirements-dev.txt`.

- **Frameworks used:**
  - `pytest` for tests and `pytest-cov` for coverage reporting (common dev dependencies).

- **Setup (one-time):**
```bash
cd flask_backend
python -m venv venv
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
# source venv/bin/activate
pip install -e .
pip install -r requirements-dev.txt
```

- **Run all tests:** From `flask_backend/`:
```bash
pytest -v
```

- **Run a single test file or test:** Examples:
```bash
# Run one test file
pytest -q tests/test_login.py

# Run a single test function in a file
pytest tests/test_login.py::test_login_success -q
```

- **Common pytest options:**
  - `-v` verbose, `-q` quiet, `-k "keyword"` run tests matching keyword, `-x` stop after first failure.
  - Use `pytest -k "login and not slow"` to filter by name/markers.

- **Test conventions:**
  - File names: `test_*.py`
  - Test functions: `def test_<behavior>():`
  - Use fixtures from `flask_backend/tests/conftest.py` for app/client/db setup.
  - Keep controller tests focused on request/response shapes and status codes; keep model tests focused on DB interactions and schema validations.

- **Quick debugging tips:**
  - Run a failing test with `-k` and `-s` to see print/log output.
  - Use `pytest --pdb` to drop into debugger on failure.
  - Inspect test DB by printing path or configuring a temporary file DB if you need to examine data.

- **Adding tests (where to place & examples):**
  - Place new tests in `flask_backend/tests/`, name `test_<feature>.py`.
  - Use existing patterns in `flask_backend/tests/test_user.py` as examples for auth and role-based checks.

- **What testing was performed (summary):**
  - Unit tests for models and schema validation.
  - Integration tests for Flask controllers/endpoints (auth, user, classes, reviews).
  - Role-based and permission checks (student/teacher/admin) covered in controller tests.

- **Next steps to finalize the guide (recommended):**
  - Add a short matrix of CI commands (how tests run in CI).
  - Add coverage instructions (e.g., `pytest --cov=api` and how to view HTML report).
  - Document any test markers (e.g., `@pytest.mark.slow`) used by the project.

---
This is a lightweight, initial draft of the Testing Instructions section. If you want, I can also add a small example test file or CI/coverage commands.
