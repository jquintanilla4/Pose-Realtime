.PHONY: dev backend frontend

dev:
	make -j2 backend frontend

backend:
	cd backend && uv sync && uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

frontend:
	cd frontend && npm run dev
