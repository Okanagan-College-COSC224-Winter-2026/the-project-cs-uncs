# Getting Started with Peer Evaluation App

**⏱️ Time to first run: ~10 minutes**

This guide will get you from zero to a running application as quickly as possible. If you run into issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## 📋 Prerequisites Check

Before you begin, ensure you have these installed:

| Tool | Minimum Version | Check Command | Install Guide |
|------|----------------|---------------|---------------|
| **Python** | 3.8+ | `python --version` or `python3 --version` | [flask_backend/README.md](../flask_backend/README.md#installing-python) |
| **Node.js** | 20.x LTS | `node --version` | [frontend/README.md](../frontend/README.md#installing-nodejs) |
| **npm** | Included with Node | `npm --version` | Comes with Node.js |
| **Git** | Any recent | `git --version` | [git-scm.com](https://git-scm.com/downloads) |

**Quick OS-Specific Notes:**
- **Windows**: Use PowerShell (not CMD). You may need to adjust execution policies for Python venv.
- **macOS**: Use `python3` and `pip3` commands (not `python`/`pip`).
- **Linux**: Most tools available via package manager (`apt`, `dnf`, etc.).

---

## Running Application if Setup Complete

### Backend

**Windows**
New terminal in the directory the-project-cs-uncs.
cd flask_backend
.\venv\Scripts\Activate.ps1
$env:FLASK_APP = "api"
$env:SMTP_HOST="smtp.gmail.com"
$env:SMTP_PORT="587"
$env:SMTP_USER="your_email@gmail.com"
$env:SMTP_PASS="App Password"
$env:SMTP_FROM_EMAIL="your_email@gmail.com"
$env:SMTP_FROM_NAME="Peer Evaluation App"
$env:SMTP_USE_SSL="false"
flask run

**Mac**
New terminal in the directory the-project-cs-uncs.
cd flask_backend
source venv/bin/activate
export FLASK_APP=api
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your_email@gmail.com
export SMTP_PASS=App Password
export SMTP_FROM_EMAIL=your_email@gmail.com
export SMTP_FROM_NAME=Peer Evaluation App
export SMTP_USE_SSL=false
flask run

### Frontend
New terminal in the directory the-project-cs-uncs.
cd frontend
npm run dev

---

## 🚀 Quick Setup (5 Steps)

### Step 1: Clone the Repository

```bash
git clone https://github.com/COSC470Fall2025/Peer-Evaluation-App-V1.git
cd Peer-Evaluation-App-V1
```

### Step 2: Set Up the Flask Backend

**Windows (PowerShell):**
```powershell
cd flask_backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -e .
pip install -r requirements-dev.txt
$env:FLASK_APP = "api"       # Required for all flask CLI commands in this session
$env:SMTP_HOST="smtp.gmail.com"
$env:SMTP_PORT="587"
$env:SMTP_USER="your_email@gmail.com"
$env:SMTP_PASS="App Password"
$env:SMTP_FROM_EMAIL="your_email@gmail.com"
$env:SMTP_FROM_NAME="Peer Evaluation App"
$env:SMTP_USE_SSL="false"
flask init_db
flask add_users
```

**macOS/Linux:**
```bash
cd flask_backend
python3 -m venv venv
source venv/bin/activate
pip install -e .
pip install -r requirements-dev.txt
export FLASK_APP=api
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your_email@gmail.com
export SMTP_PASS=App Password
export SMTP_FROM_EMAIL=your_email@gmail.com
export SMTP_FROM_NAME=Peer Evaluation App
export SMTP_USE_SSL=false
flask init_db
flask add_users
```

> **Heads up:** Every new terminal session needs the `FLASK_APP=api` environment variable before running `flask` commands. On PowerShell you can re-run `$env:FLASK_APP = "api"`, and on macOS/Linux run `export FLASK_APP=api` (or add it to your shell profile for persistence).

**What this does:**
- Creates isolated Python environment
- Installs all backend dependencies
- Creates SQLite database with schema
- Adds sample users (student, teacher, admin)

### Step 3: Start the Backend Server

**Keep your terminal open with the virtual environment activated**, then run:

```bash
flask run
```

**Expected output:**
```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

✅ **Backend is now running on port 5000**

**Leave this terminal running** and open a new terminal for the next step.

### Step 4: Set Up the Frontend

In a **new terminal**, navigate to the frontend directory:

```bash
cd frontend
npm install
```

**What this does:**
- Installs all frontend dependencies (React, Vite, TypeScript, etc.)

### Step 5: Start the Frontend Server

```bash
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

✅ **Frontend is now running on port 3000**

---

## 🎉 Verify Installation

### 1. Open Your Browser

Navigate to: **http://localhost:3000**

You should see the login page for the Peer Evaluation App.

### 2. Test Login

Use one of these test accounts (created by `flask add_users`):

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@example.com | 123456 |
| **Teacher** | teacher@example.com | 123456 |
| **Student** | student@example.com | 123456 |

### 3. Verify Backend Health

In a new terminal or browser, check:
```bash
curl http://localhost:5000/hello
```

**Expected response:**
```json
{"message": "Hello, World!"}
```

---

## 🎯 What You Have Now

✅ **Backend API** running on `http://localhost:5000`
- Flask REST API with JWT authentication
- SQLite database with sample data
- Role-based access control (Student, Teacher, Admin)

✅ **Frontend SPA** running on `http://localhost:3000`
- React + TypeScript + Vite
- Communicates with backend via REST API
- Protected routes with authentication

---

## 📚 Next Steps

Now that you have the app running, here's what to explore next:

### For New Developers
1. **[ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md)** - Understand what this app does and how it works
2. **[CONTRIBUTING.md](CONTRIBUTING.md)** - Learn the development workflow
3. **[Database Schema](schema/database-schema.md)** - Understand the data model
4. **[TESTING.md](TESTING.md)** - Learn how to write and run tests

### For Exploring the Codebase
- **Backend entry point**: `flask_backend/api/__init__.py`
- **Backend controllers**: `flask_backend/api/controllers/`
- **Database models**: `flask_backend/api/models/`
- **Frontend routes**: `frontend/src/App.tsx`
- **API client**: `frontend/src/util/api.ts`

### For Development Tasks
- **API Documentation**: [dev-guidelines/ENDPOINT_SUMMARY.md](dev-guidelines/ENDPOINT_SUMMARY.md)
- **Role Permissions**: [dev-guidelines/ROLE_PERMISSION_SUMMARY.md](dev-guidelines/ROLE_PERMISSION_SUMMARY.md)
- **Git Workflow**: [dev-guidelines/dev-ops.md](dev-guidelines/dev-ops.md)

---

## 🛑 Stopping the Application

To stop the servers:

1. **Backend**: Press `Ctrl+C` in the flask terminal
2. **Frontend**: Press `Ctrl+C` in the npm terminal
3. **Deactivate Python venv**: Run `deactivate` in the backend terminal

---

## ❓ Common Issues

| Issue | Quick Fix |
|-------|-----------|
| Port 5000 already in use | Stop other processes using port 5000, or change Flask port with `flask run --port 5001` |
| Port 3000 already in use | Stop other processes or see [frontend README](../frontend/README.md) for port configuration |
| `flask: command not found` | Make sure Python venv is activated and `export FLASK_APP=api` has been run to set environment variable|
| Import errors | Re-run `pip install -e .` in flask_backend with venv activated |
| Database errors | Delete `flask_backend/instance/app.sqlite` and re-run `flask init_db` |

**For more detailed troubleshooting**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 🔄 Daily Development Workflow

**Every time you start working:**

1. **Terminal 1** - Backend:
   ```bash
   cd flask_backend
   source venv/bin/activate  # or .\venv\Scripts\Activate.ps1 on Windows
   flask run
   ```

2. **Terminal 2** - Frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open browser to `http://localhost:3000`

---

## 💡 Pro Tips

- **Backend hot-reload**: Flask runs in debug mode by default, so code changes reload automatically
- **Frontend hot-reload**: Vite provides instant HMR (Hot Module Replacement)
- **Database inspection**: Use `sqlite3 flask_backend/instance/app.sqlite` to query the database directly
- **API testing**: Use `curl`, Postman, or the browser DevTools to test endpoints
- **Check logs**: Backend logs appear in the Flask terminal, frontend logs in browser console

---

## 📖 Documentation Index

See [docs/README.md](README.md) for a complete guide to all documentation.

---

**Questions or stuck?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or ask the team!
