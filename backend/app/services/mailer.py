"""Sending email (password-reset links). Plain SMTP, so any provider works."""

import logging
import smtplib
from email.message import EmailMessage

from app.config import get_settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> None:
    """Send one email. Never raises: a mail problem must not break the request that asked for it."""
    settings = get_settings()
    if not settings.smtp_host:
        if settings.app_env != "production":
            # Development convenience only. The message holds a secret link, so production never logs it.
            logger.warning("SMTP is not configured; email to %s was not sent:\n%s\n%s", to, subject, body)
        else:
            logger.error("SMTP_HOST is not configured; an email could not be sent")
        return
    message = EmailMessage()
    message["From"] = settings.smtp_from or settings.smtp_user or "no-reply@localhost"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        logger.error("Sending email failed: %s", type(exc).__name__)
