[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/Qs_OeS3S)
# Peer Evaluation App

## What is This?

The Peer Evaluation App is an academic platform for **structured peer review and group evaluation**. It enables:

- **Instructors** to create courses, assignments, and organize students into groups
- **Students** to submit work and provide anonymous peer evaluations using rubrics
- **Fair assessment** of individual contributions in collaborative projects

**Use cases:**
- Group project evaluations in software engineering courses
- Peer review of presentations or written assignments
- Team contribution tracking and accountability

See [Architecture Overview](docs/ARCHITECTURE_OVERVIEW.md) for detailed explanation of workflows and concepts.

---

## 🚀 Quick Start (Docker)

**Want to run the full stack locally?** Follow these steps using Docker Compose:

```bash
# 1. Clone the repository
git clone https://github.com/COSC470Fall2025/Peer-Evaluation-App-V1.git
cd Peer-Evaluation-App-V1

# 2. Create a root-level .env (docker compose reads this automatically)
cp flask_backend/.env.example .env   # or copy the template in docs/GETTING_STARTED.md

#    Minimum values required:
#    SECRET_KEY=<random-string>
#    JWT_SECRET_KEY=<random-string>
#    DEFAULT_ADMIN_NAME="Example Admin"
#    DEFAULT_ADMIN_EMAIL="admin@example.com"
#    DEFAULT_ADMIN_PASSWORD="ChangeMe123!"
#    # Remaining entries already fall back to sensible defaults

# 3. Start all services (initial build may take several minutes)
docker compose up --build -d

# 4. Access the app
# Frontend: http://localhost
# Backend API: http://localhost:5000
# Default admin credentials are sourced from DEFAULT_ADMIN_* in .env
```

**What's included:**

- ✅ PostgreSQL database (port 5432)
- ✅ Flask backend API (port 5000)
- ✅ React frontend (port 80)
- ✅ Sample data and test accounts

**Stop the app:**

```bash
docker-compose down         # Stop services
docker-compose down -v      # Stop and remove database data
```

**For detailed setup and local development** (without Docker), see [Getting Started Guide](docs/GETTING_STARTED.md).

---

## Features

### [Role-Based Access Control](docs/dev-guidelines/ROLE_PERMISSION_SUMMARY.md)

- **Students**: Submit assignments, participate in peer reviews, view their courses
- **Teachers**: Create courses and assignments, manage student rosters, create groups
- **Admins**: Create teacher/admin accounts, manage all users, system-wide administration

### Core Functionality

- ✅ JWT-based authentication with HTTPOnly cookies
- ✅ Role-based authorization (Student, Teacher, Admin)
- ✅ RESTful API with Flask backend
- ✅ React + TypeScript frontend with Vite
- ✅ SQLite (dev) / PostgreSQL (production) support
- ✅ Course and assignment management
- ✅ Student roster upload with auto-account creation
- 🚧 Group creation and management (in progress)
- 🚧 Rubric-based peer evaluations (in progress)
- 🚧 Anonymous peer review workflows (planned)

## Prerequisites

Before starting, ensure you have:

- **Python 3.8+** for Flask backend
- **Node.js 20.x LTS** for React frontend  
- **npm** (comes with Node.js)
- **Git** for version control
- **Linux/macOS/Windows** (WSL2 recommended for Windows)

**Installation help:** See [GETTING_STARTED.md](docs/GETTING_STARTED.md#prerequisites-check)

---

## Project Structure

```text
├── flask_backend/        # Flask REST API (Python)
│   ├── api/              # Application code
│   │   ├── controllers/  # Route handlers (blueprints)
│   │   ├── models/       # Database models (SQLAlchemy)
│   │   └── cli/          # CLI commands
│   └── tests/            # Backend tests (pytest)
├── frontend/             # React app (TypeScript + Vite)
│   └── src/
│       ├── components/   # Reusable React components
│       ├── pages/        # Page components (routes)
│       └── util/         # API client & utilities
└── docs/                 # Project documentation
    ├── GETTING_STARTED.md        # ⭐ Start here
    ├── ARCHITECTURE_OVERVIEW.md  # System design & workflows
    ├── CONTRIBUTING.md           # Development workflow
    ├── TESTING.md                # Testing guide
    ├── TROUBLESHOOTING.md        # Common issues
    ├── dev-guidelines/           # API docs, roles, deployment
    └── schema/                   # Database schema & architecture
```

## 📚 Documentation

### For New Developers

1. **[Getting Started](docs/GETTING_STARTED.md)** - ⭐ Setup guide (start here!)
2. **[Architecture Overview](docs/ARCHITECTURE_OVERVIEW.md)** - Understand the system
3. **[Contributing](docs/CONTRIBUTING.md)** - Development workflow
4. **[Testing](docs/TESTING.md)** - How to write and run tests

### Reference Documentation

- **[API Endpoints](docs/dev-guidelines/ENDPOINT_SUMMARY.md)** - REST API reference
- **[Role Permissions](docs/dev-guidelines/ROLE_PERMISSION_SUMMARY.md)** - Access control details
- **[Database Schema](docs/schema/database-schema.md)** - Data model & relationships
- **[Project Architecture](docs/schema/project-architecture.md)** - Technical stack overview
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues & solutions
- **[DevOps Guidelines](docs/dev-guidelines/dev-ops.md)** - Git workflow & CI/CD
- **[Production Deployment](docs/dev-guidelines/PRODUCTION_DEPLOYMENT.md)** - Deployment guide

**Full documentation index:** [docs/README.md](docs/README.md)

---

## 🤝 Contributing

We welcome contributions! Please read:

1. **[CONTRIBUTING.md](docs/CONTRIBUTING.md)** - Development workflow
2. **[TESTING.md](docs/TESTING.md)** - How to write tests
3. **[DevOps Guidelines](docs/dev-guidelines/dev-ops.md)** - Git conventions

**Quick contribution workflow:**

1. Fork and clone the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and write tests
4. Ensure all tests pass: `pytest`
5. Push and open a Pull Request to `dev` branch

---

## 📄 License

This project is for educational purposes as part of COSC 470 at Okanagan College.

---

## 🆘 Need Help?

- **Setup issues?** [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **How does this work?** [ARCHITECTURE_OVERVIEW.md](docs/ARCHITECTURE_OVERVIEW.md)
- **Want to contribute?** [CONTRIBUTING.md](docs/CONTRIBUTING.md)
- **All documentation:** [docs/README.md](docs/README.md)

**Still stuck?** Check existing GitHub Issues or create a new one.

## Important Notes

- Frontend uses HTTPOnly cookies for JWT token storage
- Backend tests use in-memory SQLite database
- Default role for public registration is 'student'
- Teachers and admins must be created by existing admins
- **PRODUCTION SECURITY**: See [Production Deployment Guide](docs/dev-guidelines/PRODUCTION_DEPLOYMENT.md) for required security configuration before deploying to production

## Contributing

1. Create a feature branch from `dev` ([follow guidelines](docs/dev-guidelines/dev-ops.md))
2. Make your changes
3. Write/update tests
4. Update documentation
5. Submit a pull request to `dev`

## License

See [LICENSE](LICENSE) file for details.
