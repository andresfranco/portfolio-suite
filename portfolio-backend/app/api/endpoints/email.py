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
    """
    Send a contact form email from website visitors to the portfolio owner.
    The email is sent TO the portfolio owner (SMTP_USER) FROM the visitor.
    """
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["From"] = f"{email_request.name} <{settings.SMTP_FROM_EMAIL}>"
        message["Reply-To"] = email_request.email
        message["To"] = settings.SMTP_FROM_EMAIL  # Send to portfolio owner
        message["Subject"] = f"Portfolio Contact: {email_request.subject}"

        # Create plain text and HTML versions
        text_body = f"""
New Contact Form Submission

From: {email_request.name}
Email: {email_request.email}
Subject: {email_request.subject}

Message:
{email_request.message}

---
This message was sent from your portfolio contact form.
Reply directly to this email to respond to {email_request.name}.
"""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #14C800; color: white; padding: 20px; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
        .field {{ margin-bottom: 15px; }}
        .label {{ font-weight: bold; color: #555; }}
        .message {{ background-color: white; padding: 15px; border-left: 3px solid #14C800; margin-top: 10px; }}
        .footer {{ text-align: center; color: #777; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">New Contact Form Submission</h2>
        </div>
        <div class="content">
            <div class="field">
                <span class="label">From:</span> {email_request.name}
            </div>
            <div class="field">
                <span class="label">Email:</span> <a href="mailto:{email_request.email}">{email_request.email}</a>
            </div>
            <div class="field">
                <span class="label">Subject:</span> {email_request.subject}
            </div>
            <div class="field">
                <span class="label">Message:</span>
                <div class="message">{email_request.message.replace(chr(10), '<br>')}</div>
            </div>
        </div>
        <div class="footer">
            This message was sent from your portfolio contact form.<br>
            Reply directly to this email to respond to {email_request.name}.
        </div>
    </div>
</body>
</html>
"""

        # Attach both versions
        message.attach(MIMEText(text_body, "plain"))
        message.attach(MIMEText(html_body, "html"))

        # Create secure context
        context = ssl.create_default_context()

        # Connect to SMTP server using STARTTLS (port 587)
        # Note: Port 587 uses STARTTLS, not SSL
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls(context=context)  # Upgrade to secure connection
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(message)

        logger.info(f"Contact form email sent successfully from {email_request.name} ({email_request.email})")
        return {
            "success": True,
            "message": "Your message has been sent successfully! I'll get back to you soon."
        }

    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Email service configuration error. Please contact the site administrator."
        )
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error occurred: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to send email. Please try again later or contact me directly."
        )
    except Exception as e:
        logger.error(f"Unexpected error sending email: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred. Please try again later."
        )
