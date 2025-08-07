from functools import wraps
from app.core.logging import setup_logger

# Set up logger
logger = setup_logger("app.core.db")

def db_transaction(func):
    """
    Decorator to handle database transactions consistently.
    Implements proper transaction management with commit/rollback.
    
    Usage:
        @db_transaction
        def my_crud_function(db, ...):
            # function body
            
    Args:
        func: The function to wrap with transaction management
        
    Returns:
        Decorated function that handles transactions
    """
    @wraps(func)
    def wrapper(db, *args, **kwargs):
        try:
            # Execute the wrapped function
            result = func(db, *args, **kwargs)
            
            # Successfully executed - commit the transaction
            db.commit()
            logger.debug(f"Transaction committed for {func.__name__}")
            
            return result
            
        except Exception as e:
            # Error occurred - rollback the transaction
            db.rollback()
            logger.error(f"Transaction rolled back for {func.__name__}: {str(e)}")
            
            # Re-raise the exception for higher-level handling
            raise
            
    return wrapper 