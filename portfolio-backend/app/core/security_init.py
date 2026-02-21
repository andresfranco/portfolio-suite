"""
Security Monitoring Initialization

Initializes and configures security monitoring and alerting system.
"""

import logging
from app.core.security_monitor import security_monitor
from app.core.security_alerts import alert_manager
from app.core.config import settings

logger = logging.getLogger(__name__)


def init_security_monitoring():
    """
    Initialize security monitoring and alerting.
    
    Should be called during application startup.
    """
    logger.info("Initializing security monitoring...")
    
    # Register alert manager with security monitor
    security_monitor.register_alert_callback(alert_manager.handle_alert)
    
    # Configure email alerts if enabled
    if getattr(settings, 'SECURITY_EMAIL_ALERTS_ENABLED', False):
        recipients = getattr(settings, 'SECURITY_ALERT_RECIPIENTS', [])
        if recipients:
            alert_manager.configure_email_alerts(
                recipients=recipients.split(',') if isinstance(recipients, str) else recipients
            )
            logger.info(f"Email alerts configured for {len(recipients)} recipients")
    
    # Configure webhook alerts if enabled
    webhook_urls = getattr(settings, 'SECURITY_WEBHOOK_URLS', None)
    if webhook_urls:
        urls = webhook_urls.split(',') if isinstance(webhook_urls, str) else webhook_urls
        for url in urls:
            alert_manager.add_webhook(url.strip())
        logger.info(f"Configured {len(urls)} webhook alert(s)")
    
    # Configure Slack webhooks if enabled
    slack_webhooks = getattr(settings, 'SECURITY_SLACK_WEBHOOKS', None)
    if slack_webhooks:
        urls = slack_webhooks.split(',') if isinstance(slack_webhooks, str) else slack_webhooks
        for url in urls:
            alert_manager.add_slack_webhook(url.strip())
        logger.info(f"Configured {len(urls)} Slack webhook(s)")
    
    logger.info("Security monitoring initialized successfully")


__all__ = ['init_security_monitoring']

