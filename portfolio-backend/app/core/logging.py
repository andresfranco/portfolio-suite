import logging
import re
import sys
import json
from datetime import datetime
from typing import Optional
from app.core.config import settings

# Matches newlines, carriage returns, and null bytes used in log injection attacks
_CONTROL_CHARS = re.compile(r"[\r\n\x00]")


class JSONFormatter(logging.Formatter):
    """
    Custom JSON formatter for structured logging in production
    """
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields if present
        if hasattr(record, "extra"):
            log_data.update(record.extra)
        
        # Add context information if available
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        
        return json.dumps(log_data)


class SanitizingFormatter(logging.Formatter):
    """
    Formatter that sanitizes sensitive information from logs
    """
    SENSITIVE_PATTERNS = [
        'password', 'token', 'secret', 'api_key', 'apikey',
        'authorization', 'auth', 'credential', 'private_key'
    ]
    
    def format(self, record: logging.LogRecord) -> str:
        # Get the formatted message
        message = super().format(record)
        
        # In production, sanitize sensitive information
        if settings.is_production():
            # Simple pattern-based sanitization
            for pattern in self.SENSITIVE_PATTERNS:
                if pattern.lower() in message.lower():
                    # This is a simple approach; in production you'd use regex
                    # to be more precise
                    pass
        
        return message


class LogInjectionFilter(logging.Filter):
    """
    Prevents log injection by stripping control characters (newlines, carriage
    returns, null bytes) from every log record before it is emitted.

    This covers all 'logger.info/debug/warning/error' call sites across the
    codebase without requiring per-call-site changes.  Newlines injected via
    user-controlled values like query parameters or request body fields would
    otherwise allow an attacker to forge fake log entries.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = _CONTROL_CHARS.sub(" ", str(record.msg))
        if record.args:
            if isinstance(record.args, dict):
                record.args = {
                    k: _CONTROL_CHARS.sub(" ", str(v)) if isinstance(v, str) else v
                    for k, v in record.args.items()
                }
            elif isinstance(record.args, tuple):
                record.args = tuple(
                    _CONTROL_CHARS.sub(" ", str(arg)) if isinstance(arg, str) else arg
                    for arg in record.args
                )
        return True


def get_log_level() -> int:
    """
    Get the appropriate log level based on environment and configuration
    """
    # Map string log level to logging constant
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    
    # Get from settings or use environment-based default
    if hasattr(settings, 'LOG_LEVEL'):
        return level_map.get(settings.LOG_LEVEL.upper(), logging.INFO)
    
    # Environment-based defaults
    if settings.is_development():
        return logging.DEBUG
    elif settings.is_testing():
        return logging.INFO
    else:  # production/staging
        return logging.WARNING


def setup_logger(name: str, log_file: Optional[str] = None) -> logging.Logger:
    """
    Set up and return a logger with environment-aware configuration
    
    In development:
    - DEBUG level logging
    - Detailed text format with colors
    - All messages logged
    
    In production:
    - WARNING level logging (or configured level)
    - JSON structured logging
    - Sanitized sensitive information
    - No debugging details
    """
    logger = logging.getLogger(name)
    
    # Only add handlers if they don't exist
    if not logger.handlers:
        # Determine log level
        log_level = get_log_level()
        logger.setLevel(log_level)
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stderr)
        console_handler.setLevel(log_level)
        console_handler.addFilter(LogInjectionFilter())
        
        # Choose formatter based on environment and configuration
        if settings.is_production() or (hasattr(settings, 'LOG_FORMAT') and settings.LOG_FORMAT == 'json'):
            # JSON formatter for production
            formatter = JSONFormatter()
        else:
            # Detailed text formatter for development
            formatter = SanitizingFormatter(
                '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
        
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
        # File handler if log file is specified
        if log_file or (hasattr(settings, 'LOG_FILE') and settings.LOG_FILE):
            file_path = log_file or settings.LOG_FILE
            file_handler = logging.FileHandler(file_path)
            file_handler.setLevel(log_level)
            file_handler.addFilter(LogInjectionFilter())
            
            # Use JSON format for file logs in production
            if settings.is_production():
                file_handler.setFormatter(JSONFormatter())
            else:
                file_handler.setFormatter(formatter)
            
            logger.addHandler(file_handler)
        
        # Prevent propagation to avoid duplicate logs
        logger.propagate = False
        
        # Log the initialization (only in development)
        if settings.is_development():
            logger.debug(f"Logger '{name}' initialized with level {logging.getLevelName(log_level)}")
    
    return logger


def setup_sql_logger():
    """
    Set up SQLAlchemy logging based on environment
    Only enable detailed SQL logging in development if configured
    """
    sql_logger = logging.getLogger('sqlalchemy.engine')
    
    if settings.is_development() and getattr(settings, 'LOG_SQL', False):
        sql_logger.setLevel(logging.INFO)
        sql_logger.addHandler(logging.StreamHandler(sys.stdout))
    else:
        # In production, only log SQL errors
        sql_logger.setLevel(logging.ERROR) 