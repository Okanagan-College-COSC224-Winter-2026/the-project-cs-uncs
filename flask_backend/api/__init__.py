import os

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, get_jwt, get_jwt_identity, verify_jwt_in_request
from flask_jwt_extended.exceptions import JWTExtendedException
from jwt.exceptions import PyJWTError

from .cli import init_app
from .controllers import (
    admin_controller,
    auth_controller,
    class_controller,
    fake_api_controller,
    user_controller,
    assignment_controller,
)
from .models.db import db, ma


def create_app(test_config=None):
    """Create and configure the Flask application"""
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)

    # Determine if we're in production based on FLASK_ENV or explicit PRODUCTION flag
    is_production = (
        os.environ.get("FLASK_ENV") == "production"
        or os.environ.get("PRODUCTION", "false").lower() == "true"
    )

    # Validate required secrets in production
    if is_production:
        required_secrets = ["SECRET_KEY", "JWT_SECRET_KEY", "DATABASE_URL"]
        missing = [key for key in required_secrets if not os.environ.get(key)]
        if missing:
            raise RuntimeError(
                f"Production mode requires these environment variables: {', '.join(missing)}"
            )

    # Default configuration
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev"),
        # A local sqlite database stored in the instance folder for development
        # For production, set the DATABASE_URL environment variable to the database URI
        SQLALCHEMY_DATABASE_URI=os.environ.get(
            "DATABASE_URL", "sqlite:///" + os.path.join(app.instance_path, "app.sqlite")
        ),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        JWT_SECRET_KEY=os.environ.get("JWT_SECRET_KEY", "dev-jwt-secret"),
        # JWT Cookie settings - secure defaults for production, permissive for development
        JWT_TOKEN_LOCATION=["cookies"],
        JWT_COOKIE_SECURE=is_production,  # True in production (HTTPS required)
        JWT_COOKIE_CSRF_PROTECT=is_production,  # True in production for CSRF protection
        JWT_COOKIE_SAMESITE=(
            "Strict" if is_production else "Lax"
        ),  # Strict in production for maximum security
        JWT_ACCESS_COOKIE_PATH="/",
        JWT_COOKIE_DOMAIN=os.environ.get("JWT_COOKIE_DOMAIN", None),
    )

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile("config.py", silent=True)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)

    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # Initialize extensions
    db.init_app(app)
    ma.init_app(app)

    jwt = JWTManager()
    jwt.init_app(app)

    # Embed must_change_password in every JWT so the before_request
    # hook can check it without hitting the database on every request.
    @jwt.additional_claims_loader
    def add_claims(identity):
        from .models import User  # local import to avoid circular refs

        user = User.get_by_email(identity)
        if user:
            return {"must_change_password": user.must_change_password}
        return {}

    # Configure CORS to allow credentials (cookies)
    # In production, configure allowed origins via CORS_ORIGINS env var (comma-separated)
    cors_origins = (
        os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
        if os.environ.get("CORS_ORIGINS")
        else ["http://localhost:3000", "http://localhost:5173"]
    )
    CORS(
        app,
        origins=cors_origins,
        supports_credentials=True,
        allow_headers=["Content-Type", "X-CSRF-TOKEN"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    # a simple page that says hello
    @app.route("/hello")
    def hello():
        return {"message": "Hello, World!"}

    # Initialize CLI commands
    init_app(app)

    # ── Enforce must_change_password globally ──────────────────────
    # Blueprint prefixes (and bare endpoints) that should never trigger
    # the must_change_password check.  Skipping these avoids the cost
    # of JWT cookie parsing / decoding on every request.
    _SKIP_PASSWORD_CHECK_PREFIXES = ("auth.", "static.", "fake.")

    # Individual non-blueprint endpoints to skip (e.g. top-level routes)
    _SKIP_PASSWORD_CHECK_ENDPOINTS = {"hello", None}

    # Endpoints that *do* require a valid JWT but should still be
    # allowed when the user must change their password (they need
    # these to detect the flag, change their password, or log out).
    _PASSWORD_CHANGE_EXEMPT = {
        ("user.get_current_user", "GET"),    # GET /user/ — frontend reads the flag
        ("user.change_password", "PATCH"),   # PATCH /user/password — the change itself
    }

    @app.before_request
    def enforce_password_change():
        """Block users who must change their temporary password from
        accessing any protected endpoint except the exempt ones.

        Reads the ``must_change_password`` flag directly from the JWT
        claims (embedded at token creation / refresh via
        ``additional_claims_loader``) so **no database query** is
        needed on every authenticated request.
        """
        # CORS preflight requests never carry cookies — skip immediately
        if request.method == "OPTIONS":
            return

        # Fast path: skip endpoints that never need this check
        # (unauthenticated routes, static files, etc.)
        endpoint = request.endpoint
        if endpoint in _SKIP_PASSWORD_CHECK_ENDPOINTS:
            return
        if endpoint and any(endpoint.startswith(p) for p in _SKIP_PASSWORD_CHECK_PREFIXES):
            return

        # Only check endpoints that require a JWT cookie
        try:
            verify_jwt_in_request(optional=True)
            identity = get_jwt_identity()
        except (JWTExtendedException, PyJWTError):
            return  # No valid JWT → let the endpoint handle 401 itself

        if identity is None:
            return  # Unauthenticated request — nothing to enforce

        # Check if the matched endpoint is exempt
        if (endpoint, request.method) in _PASSWORD_CHANGE_EXEMPT:
            return

        # Read the flag from JWT claims – no DB hit required
        claims = get_jwt()
        if claims.get("must_change_password", False):
            return jsonify({"msg": "Password change required before continuing"}), 403

    # Register blueprints
    app.register_blueprint(auth_controller.bp)
    app.register_blueprint(user_controller.bp)
    app.register_blueprint(admin_controller.bp)
    app.register_blueprint(class_controller.bp)
    app.register_blueprint(assignment_controller.bp)
    app.register_blueprint(fake_api_controller.fake)

    return app
