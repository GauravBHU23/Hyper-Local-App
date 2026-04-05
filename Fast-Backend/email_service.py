import smtplib
from email.message import EmailMessage

from config import settings


def send_otp_email(to_email: str, otp_code: str, purpose: str = "login") -> None:
    subject = "Your HyperLocal OTP"
    body = (
        f"Your HyperLocal {purpose} OTP is {otp_code}.\n\n"
        f"It will expire in {settings.EMAIL_OTP_EXPIRE_MINUTES} minutes."
    )

    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        print(f"[EMAIL OTP DEV FALLBACK] to={to_email} purpose={purpose} otp={otp_code}")
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = (
        f"{settings.MAIL_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        if settings.MAIL_FROM_NAME
        else settings.SMTP_FROM_EMAIL
    )
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(message)
