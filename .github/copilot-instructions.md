# Copilot / AI agent instructions — Peer-Evaluation-App-V1

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

## Big picture — dual backend architecture
**Important**: This repo has TWO separate backends in transition:
1. **`flask_backend/`** (Python Flask) — Active backend, use this for new work
   - JWT auth via HTTPOnly cookies (Flask-JWT-Extended)
   - SQLAlchemy ORM + Marshmallow schemas
   - Dev DB: SQLite (instance/app.sqlite), Prod: PostgreSQL
2. **`backend/`** (Node.js/Fastify + Sequelize) — Legacy/reference implementation
   - MariaDB backend (via docker-compose)
   - Do NOT modify unless explicitly requested

**`frontend/`** (React + TypeScript + Vite) talks to Flask backend at `http://localhost:5000` (dev) via `frontend/src/util/api.ts` (BASE_URL constant).

## Role-based access control (RBAC)
System uses three roles (`student`, `teacher`, `admin`) stored in `User.role` field:
- **Students**: Can register via `/auth/register`, view own profile, submit work (planned)
- **Teachers**: All student perms + create courses/assignments (planned), view any user profile
- **Admins**: All perms + user management via `/admin/*` endpoints, cannot self-delete/demote

Key files: `flask_backend/api/models/users_model.py` (role validation + helper methods `is_teacher()`, `is_admin()`, `has_role(*roles)`), `flask_backend/api/controllers/auth_controller.py` (decorators: `jwt_role_required`, `jwt_admin_required`, `jwt_teacher_required`).

## Files to know (Flask backend only)
- Entry point: `flask_backend/api/__init__.py` (Flask app factory, CORS, JWT cookie config, blueprint registration)
- Controllers: `flask_backend/api/controllers/{auth_controller.py,user_controller.py,admin_controller.py,class_controller.py}`
- Models: `flask_backend/api/models/{db.py,users_model.py}` — more models planned per `docs/schema/`
- Tests (truth): `flask_backend/tests/{conftest.py,test_login.py,test_user.py,test_model.py}` — pytest with in-memory SQLite
- CLI: `flask_backend/api/cli/database.py` — commands: `flask init_db`, `flask add_users`, `flask create_admin`, `flask drop_db`
- Frontend contract: `frontend/src/util/api.ts` (all fetch calls include `credentials: 'include'` for cookies), `frontend/src/util/login.ts` (role helpers: `getUserRole()`, `isAdmin()`, `isTeacher()`)

## Dev workflows (local — Flask backend)
**Windows (PowerShell):**
```powershell
cd flask_backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -e .
pip install -r requirements-dev.txt
flask init_db              # Create database
flask add_users            # Add sample users (student, teacher, admin)
flask --app api run        # Start server on http://localhost:5000
```
**macOS/Linux:**
```bash
cd flask_backend
python3 -m venv venv
source venv/bin/activate
pip install -e .
pip install -r requirements-dev.txt
flask init_db
flask add_users
flask run                  # Port 5000
```
**Tests:** `cd flask_backend && pytest` (or `pytest tests/test_login.py -v` for specific tests)

**Frontend (same across all OS):**
```bash
cd frontend
npm install                # or: pnpm install (pnpm-workspace.yaml exists but npm works too)
npm run dev                # http://localhost:3000 (strict port, fails if busy)
```

**Docker (entire stack):**
```bash
docker-compose up          # Starts mariadb (port 33123), legacy backend (8081), frontend (3000)
```
Note: Docker uses the legacy Node backend at port 8081, not Flask at 5000. For local dev, run Flask + frontend separately.

## Auth pattern (HTTPOnly cookies + JWT)
**Critical security change (see `docs/HTTPONLY_COOKIES_MIGRATION.md`):**
- Tokens stored in **HTTPOnly cookies** (not localStorage), preventing XSS theft
- `/auth/login` returns `{ role, user_id, name }` (NO `access_token` in JSON)
- `/auth/logout` clears cookies via `unset_jwt_cookies()`
- All frontend requests include `credentials: 'include'` (axios/fetch)
- **Never** send `Authorization: Bearer` headers — cookies auto-attach
- Test client (`flask.testing.FlaskClient`) handles cookies automatically

Example flow:
```python
# Backend: flask_backend/api/controllers/auth_controller.py
response = jsonify(role=user.role, user_id=user.id, name=user.name)
set_access_cookies(response, access_token)  # Sets httponly cookie
```
```typescript
// Frontend: frontend/src/util/api.ts
const response = await fetch(`${BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
  credentials: 'include'  // Must include for cookies
});
```

## Conventions and patterns
- **Blueprints per feature:** Register in `flask_backend/api/__init__.py` (e.g., `app.register_blueprint(auth_controller.bp)`)
- **Marshmallow schemas:** Use for JSON serialization (see `UserSchema(exclude=['password'])` in controllers)
- **Never expose passwords:** Always exclude from schemas and responses
- **Tests as contract:** Changes must pass existing tests (`test_login.py`, `test_user.py`, `test_model.py`) — no guessing
- **Role checks:** Use decorators (`@jwt_role_required('admin')`) or model methods (`user.is_admin()`, `user.has_role('teacher', 'admin')`)
- **Config hierarchy:** Defaults in `api/__init__.py`, overrides in `api/config.py` (not committed), env vars for secrets

## Known gaps and integration points
- **Endpoints.json vs reality:** `docs/dev-guidelines/endpoints.json` is a legacy Node API spec (for reference only). Many routes (`/classes`, `/create_*`, groups, rubrics) exist in Node `backend/src/routes/` but NOT in Flask. When implementing missing endpoints, use Flask patterns (blueprints + Marshmallow) and add tests.
- **Database schema mismatch:** Flask has minimal models (User, Class). Full schema in `docs/schema/database-schema.md` includes Group, Assignment, Review, Criteria — implement as needed.
- **Frontend assumes Node backend shape:** Some frontend code may expect responses matching Node routes. Check `endpoints.json` for field names when implementing Flask equivalents.
- **Port confusion:** Frontend `BASE_URL` points to 5000 (Flask), but Docker runs Node backend on 8081. Adjust per deployment.

## Quick reference
**Add a new Flask route:**
1. Create handler in `flask_backend/api/controllers/your_controller.py` (or add to existing)
2. Use decorators: `@bp.route('/path', methods=['POST'])`, `@jwt_role_required('teacher')`
3. Register blueprint in `flask_backend/api/__init__.py` if new controller
4. Write test in `flask_backend/tests/test_your_feature.py` (use `client.post()`, assertions on `response.get_json()`)

**Add a user via CLI:**
```bash
flask create_admin              # Prompts for name, email, password (creates admin)
flask add_users                 # Adds sample student/teacher/admin users
```

**Check database:**
```bash
sqlite3 flask_backend/instance/app.sqlite
.tables
SELECT id, name, email, role FROM User;
```

**Migrate legacy Node endpoint to Flask:**
1. Read `backend/src/routes/your_route.ts` for logic
2. Translate Sequelize queries to SQLAlchemy (e.g., `User.findOne()` → `User.query.filter_by().first()`)
3. Match response shape from `endpoints.json` using Marshmallow schema
4. Add test covering Node behavior
5. Update frontend if response differs
