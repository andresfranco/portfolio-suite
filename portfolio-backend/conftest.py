import os
import sys
import pytest

# Add the project root directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# This will make the app module importable in tests

# Ensure Celery broker is set to a dummy value for tests so career tasks module
# can be imported without a real broker running.
os.environ.setdefault("CELERY_BROKER_URL", "memory://")