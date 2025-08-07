import logging
import sys
from app.core.config import settings

def setup_logger(name: str) -> logging.Logger:
    """Set up and return a logger with consistent configuration"""
    logger = logging.getLogger(name)
    
    # Only add handlers if they don't exist
    if not logger.handlers:
        console_handler = logging.StreamHandler(sys.stderr)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
        # Set level based on environment
        if hasattr(settings, 'ENVIRONMENT') and settings.ENVIRONMENT == "development":
            logger.setLevel(logging.DEBUG)
        else:
            logger.setLevel(logging.INFO)
    
    return logger 