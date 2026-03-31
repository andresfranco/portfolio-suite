# Career OS task sub-package.
# Import sub-modules here so Celery discovers all tasks when this package is loaded.

# Re-export legacy functions from tasks.py (now shadowed by this package).
# Use importlib so the flat tasks.py module is still accessible.
import importlib.util as _util
import os as _os

_tasks_py = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "tasks.py")
_spec = _util.spec_from_file_location("app.queue._tasks_legacy", _tasks_py)
_legacy = _util.module_from_spec(_spec)
_spec.loader.exec_module(_legacy)

enqueue_index_job = _legacy.enqueue_index_job
enqueue_delete_job = _legacy.enqueue_delete_job

# Career tasks: only import when Celery broker is configured to avoid startup errors.
from app.queue.celery_app import is_enabled as _celery_is_enabled
if _celery_is_enabled():
    from app.queue.tasks import career as _career_tasks  # noqa: F401
