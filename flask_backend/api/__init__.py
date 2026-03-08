import functools
import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from .cli import init_app
from .controllers import (
    admin_controller,
    auth_controller,
    class_controller,
    fake_api_controller,
    user_controller,
    assignment_controller,
    review_controller,
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

    # Register blueprints
    app.register_blueprint(auth_controller.bp)
    app.register_blueprint(user_controller.bp)
    app.register_blueprint(admin_controller.bp)
    app.register_blueprint(class_controller.bp)
    app.register_blueprint(assignment_controller.bp)
    app.register_blueprint(review_controller.bp)
    app.register_blueprint(fake_api_controller.fake)

    return app
