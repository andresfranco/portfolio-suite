"""
Security Alerting System

Provides multi-channel alerting for critical security events.

Supported alert channels:
- Email alerts (via SMTP)
- Webhook notifications
- Log-based alerts
- Slack/Teams integration (webhook)

Usage:
    from app.core.security_alerts import alert_manager
    
    # Register alert handler
    alert_manager.register_email_alert(
        recipient="security@example.com",
        smtp_config=smtp_settings
    )
    
    # Alerts are triggered automatically via security_monitor
"""

import logging
import smtplib
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime
import asyncio
import aiohttp

from app.core.security_monitor import SecurityEvent
from app.core.config import settings

logger = logging.getLogger(__name__)


class AlertManager:
    """
    Manages alert delivery for critical security events.
    
    Supports multiple alert channels and provides
    configurable alert rules.
    """
    
    def __init__(self):
        """Initialize alert manager"""
        self.email_recipients: List[str] = []
        self.webhook_urls: List[str] = []
        self.slack_webhooks: List[str] = []
        self.custom_handlers: List[Callable] = []
        
        # Alert throttling (prevent spam)
        self.last_alert_time: Dict[str, datetime] = {}
        self.min_alert_interval_seconds = 300  # 5 minutes between similar alerts
        
        logger.info("Alert manager initialized")
    
    def configure_email_alerts(
        self,
        recipients: List[str],
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_user: Optional[str] = None,
        smtp_password: Optional[str] = None,
        smtp_use_tls: bool = True
    ):
        """
        Configure email alerting.
        
        Args:
            recipients: List of email addresses to receive alerts
            smtp_host: SMTP server hostname
            smtp_port: SMTP server port
            smtp_user: SMTP username
            smtp_password: SMTP password
            smtp_use_tls: Whether to use TLS
        """
        self.email_recipients = recipients
        self.smtp_host = smtp_host or getattr(settings, 'SMTP_HOST', None)
        self.smtp_port = smtp_port or getattr(settings, 'SMTP_PORT', 587)
        self.smtp_user = smtp_user or getattr(settings, 'SMTP_USER', None)
        self.smtp_password = smtp_password or getattr(settings, 'SMTP_PASSWORD', None)
        self.smtp_use_tls = smtp_use_tls
        
        logger.info(f"Email alerts configured for {len(recipients)} recipients")
    
    def add_webhook(self, url: str):
        """
        Add webhook URL for alert notifications.
        
        Args:
            url: Webhook URL to POST alerts to
        """
        self.webhook_urls.append(url)
        logger.info(f"Added webhook: {url}")
    
    def add_slack_webhook(self, url: str):
        """
        Add Slack webhook for alert notifications.
        
        Args:
            url: Slack webhook URL
        """
        self.slack_webhooks.append(url)
        logger.info(f"Added Slack webhook")
    
    def register_custom_handler(self, handler: Callable):
        """
        Register custom alert handler.
        
        Args:
            handler: Async function to handle alerts
        """
        self.custom_handlers.append(handler)
        logger.info(f"Registered custom handler: {handler.__name__}")
    
    async def handle_alert(self, event: SecurityEvent):
        """
        Handle security alert for critical event.
        
        Args:
            event: Security event to alert on
        """
        # Check throttling
        alert_key = f"{event.event_type}_{event.user_id or event.ip_address}"
        
        if alert_key in self.last_alert_time:
            time_since_last = (datetime.utcnow() - self.last_alert_time[alert_key]).total_seconds()
            if time_since_last < self.min_alert_interval_seconds:
                logger.debug(f"Alert throttled for {alert_key}")
                return
        
        # Update last alert time
        self.last_alert_time[alert_key] = datetime.utcnow()
        
        # Send alerts through all configured channels
        tasks = []
        
        if self.email_recipients:
            tasks.append(self._send_email_alert(event))
        
        if self.webhook_urls:
            for url in self.webhook_urls:
                tasks.append(self._send_webhook_alert(event, url))
        
        if self.slack_webhooks:
            for url in self.slack_webhooks:
                tasks.append(self._send_slack_alert(event, url))
        
        for handler in self.custom_handlers:
            tasks.append(handler(event))
        
        # Execute all alerts concurrently
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Log any failures
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Alert delivery failed: {result}")
    
    async def _send_email_alert(self, event: SecurityEvent):
        """Send email alert"""
        if not all([self.smtp_host, self.smtp_user, self.smtp_password]):
            logger.warning("Email alerts not fully configured")
            return
        
        try:
            # Prepare email
            subject = f"[SECURITY ALERT] {event.event_type} - {event.severity.upper()}"
            
            body = f"""
Security Alert Notification

Event Type: {event.event_type}
Severity: {event.severity.upper()}
Timestamp: {event.timestamp.isoformat()}

User: {event.username or event.user_id or 'Unknown'}
IP Address: {event.ip_address or 'Unknown'}
Endpoint: {event.endpoint or 'N/A'}
Method: {event.method or 'N/A'}

Details:
{json.dumps(event.details, indent=2) if event.details else 'No additional details'}

Request ID: {event.request_id or 'N/A'}

---
This is an automated security alert from Portfolio Suite.
Please investigate this incident immediately.
            """
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.smtp_user
            msg['To'] = ', '.join(self.email_recipients)
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))
            
            # Send email (synchronous)
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                self._send_email_sync,
                msg
            )
            
            logger.info(f"Email alert sent for {event.event_type}")
            
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
            raise
    
    def _send_email_sync(self, msg: MIMEMultipart):
        """Send email synchronously"""
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            if self.smtp_use_tls:
                server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)
    
    async def _send_webhook_alert(self, event: SecurityEvent, url: str):
        """Send webhook alert"""
        try:
            payload = {
                "event_type": event.event_type,
                "severity": event.severity,
                "timestamp": event.timestamp.isoformat(),
                "user_id": event.user_id,
                "username": event.username,
                "ip_address": event.ip_address,
                "endpoint": event.endpoint,
                "method": event.method,
                "details": event.details,
                "request_id": event.request_id
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status >= 400:
                        logger.warning(
                            f"Webhook returned status {response.status}: {url}"
                        )
                    else:
                        logger.info(f"Webhook alert sent to {url}")
                        
        except Exception as e:
            logger.error(f"Failed to send webhook alert to {url}: {e}")
            raise
    
    async def _send_slack_alert(self, event: SecurityEvent, url: str):
        """Send Slack alert"""
        try:
            # Format for Slack
            color = {
                "info": "#36a64f",      # Green
                "warning": "#ff9900",   # Orange
                "error": "#ff0000",     # Red
                "critical": "#8b0000"   # Dark red
            }.get(event.severity, "#808080")
            
            payload = {
                "attachments": [
                    {
                        "color": color,
                        "title": f"Security Alert: {event.event_type}",
                        "fields": [
                            {
                                "title": "Severity",
                                "value": event.severity.upper(),
                                "short": True
                            },
                            {
                                "title": "Timestamp",
                                "value": event.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
                                "short": True
                            },
                            {
                                "title": "User",
                                "value": event.username or str(event.user_id) or "Unknown",
                                "short": True
                            },
                            {
                                "title": "IP Address",
                                "value": event.ip_address or "Unknown",
                                "short": True
                            },
                            {
                                "title": "Endpoint",
                                "value": event.endpoint or "N/A",
                                "short": False
                            }
                        ],
                        "footer": "Portfolio Suite Security Monitor",
                        "ts": int(event.timestamp.timestamp())
                    }
                ]
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status >= 400:
                        logger.warning(
                            f"Slack webhook returned status {response.status}"
                        )
                    else:
                        logger.info("Slack alert sent")
                        
        except Exception as e:
            logger.error(f"Failed to send Slack alert: {e}")
            raise
    
    def test_alert(self, channel: str = "all") -> Dict[str, Any]:
        """
        Test alert delivery.
        
        Args:
            channel: Channel to test ('email', 'webhook', 'slack', 'all')
            
        Returns:
            Test results
        """
        results = {"tested": [], "success": [], "failed": []}
        
        # Create test event
        test_event = SecurityEvent(
            event_type="security_scan",
            severity="info",
            timestamp=datetime.utcnow(),
            username="system",
            details={"test": True, "message": "This is a test alert"}
        )
        
        # Test channels synchronously for testing purposes
        if channel in ["email", "all"] and self.email_recipients:
            results["tested"].append("email")
            try:
                asyncio.run(self._send_email_alert(test_event))
                results["success"].append("email")
            except Exception as e:
                results["failed"].append({"channel": "email", "error": str(e)})
        
        return results


# Global alert manager instance
alert_manager = AlertManager()


__all__ = ['AlertManager', 'alert_manager']

