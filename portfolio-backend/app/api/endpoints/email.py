from fastapi import APIRouter, HTTPException
from app.schemas.email import EmailRequest
from app.core.config import settings
import smtplib
import ssl  # Add import for ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.logging import setup_logger

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.email")

# Define router
router = APIRouter()

@router.post("/send", response_model=dict)
async def send_email(email_request: EmailRequest):
    try:
        # Create message
        message = MIMEMultipart()
        message["From"] = settings.SMTP_USER
        message["To"] = email_request.email
        message["Subject"] = email_request.subject

        # Add body to email
        body = f"Name: {email_request.name}\n\nMessage:\n{email_request.message}"
        message.attach(MIMEText(body, "plain"))

        # Create secure SSL/TLS context
        context = ssl.create_default_context()

        # Connect to SMTP server using SSL
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
            # Login to the server
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            
            # Send email
            server.send_message(message)

        logger.info(f"Email sent successfully to {email_request.email}")
        return {"detail": "Email sent successfully"}

    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to send email. Please try again later."
        )
