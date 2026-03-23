from email.message import EmailMessage
import os
import secrets
import smtplib
import ssl
import string
from typing import Tuple

from flask import current_app


def generate_temp_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def send_new_account_email(*, recipient: str, student_name: str, temp_password: str) -> Tuple[bool, str]:
    smtp_host = (
        current_app.config.get("SMTP_HOST")
        or current_app.config.get("MAIL_SERVER")
        or os.environ.get("SMTP_HOST")
        or os.environ.get("MAIL_SERVER")
    )
    smtp_port = int(
        current_app.config.get("SMTP_PORT")
        or current_app.config.get("MAIL_PORT")
        or os.environ.get("SMTP_PORT")
        or os.environ.get("MAIL_PORT")
        or 587
    )
    smtp_user = (
        current_app.config.get("SMTP_USER")
        or current_app.config.get("MAIL_USERNAME")
        or os.environ.get("SMTP_USER")
        or os.environ.get("MAIL_USERNAME")
    )
    smtp_pass = (
        current_app.config.get("SMTP_PASS")
        or current_app.config.get("MAIL_PASSWORD")
        or os.environ.get("SMTP_PASS")
        or os.environ.get("MAIL_PASSWORD")
    )
    from_email = (
        current_app.config.get("SMTP_FROM_EMAIL")
        or current_app.config.get("MAIL_DEFAULT_SENDER")
        or os.environ.get("SMTP_FROM_EMAIL")
        or os.environ.get("MAIL_DEFAULT_SENDER")
        or smtp_user
    )
    from_name = (
        current_app.config.get("SMTP_FROM_NAME")
        or os.environ.get("SMTP_FROM_NAME")
        or "Peer Evaluation App"
    )

    if not smtp_host or not from_email:
        # During automated tests we don't want real SMTP to be required.
        # Tests that care about email behavior explicitly monkeypatch this function.
        if current_app.config.get("TESTING"):
            return True, ""
        return False, "SMTP is not configured (missing SMTP_HOST/MAIL_SERVER or sender)."

    use_ssl = str(
        current_app.config.get("SMTP_USE_SSL")
        or os.environ.get("SMTP_USE_SSL")
        or "false"
    ).lower() in {"1", "true", "yes", "on"}

    message = EmailMessage()
    message["Subject"] = "Your new Peer Evaluation account"
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = recipient
    message.set_content(
        (
            f"Hello {student_name},\n\n"
            "An account has been created for you in the Peer Evaluation App.\n\n"
            f"Email: {recipient}\n"
            f"Temporary password: {temp_password}\n\n"
            "Please sign in and change your password immediately.\n"
        )
    )

    try:
        context = ssl.create_default_context()
        if use_ssl or smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15, context=context)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)

        with server:
            server.ehlo()
            if not (use_ssl or smtp_port == 465):
                server.starttls(context=context)
                server.ehlo()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(message)
        return True, ""
    except Exception as e:
        return False, str(e)
