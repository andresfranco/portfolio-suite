venv:
	python -m venv venv
	. venv/bin/activate && pip install -q -r requirements.txt

worker-up:
	cd $(PWD) && docker compose up -d redis
	CELERY_BROKER_URL=redis://localhost:6379/0 CELERY_RESULT_BACKEND=redis://localhost:6379/1 \
		. venv/bin/activate && celery -A app.queue.celery_app:get_celery worker --loglevel=INFO

api:
	. venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	. venv/bin/activate && PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -q app/tests

