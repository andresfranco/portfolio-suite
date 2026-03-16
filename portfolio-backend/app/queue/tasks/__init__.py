# Career OS task sub-package.
# Import sub-modules here so Celery discovers all tasks when this package is loaded.
from app.queue.tasks import career as _career_tasks  # noqa: F401
