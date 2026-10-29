# Day-ahead wind forecast planner

Web app for a UK utility's day-ahead desk: shows the WINDFOR wind forecast that was available at decision time
and quantifies its error against FUELHH actuals (national, WIND only, January 2026 delivery days).

> **AI disclosure:** this project was built with assistance from Claude (Anthropic).

## Files
- `backend/main.py` FastAPI app (`/api/health`, `/api/analysis`)
- `backend/data.py` Elexon ingestion (6-day chunks) + CSV cache in `cache/`
- `backend/analytics.py` pure functions: decision-time forecast selection, metrics, error by hour/lead time
- `backend/tests/` pytest unit tests (includes a no-look-ahead test)
- `frontend/` React (Vite + Recharts) dashboard
- `docker-compose.yml` runs both services

## Run
    docker compose up --build   # UI http://localhost:3000, API http://localhost:8000/docs

Without Docker: `cd backend && pip install -r requirements.txt && uvicorn main:app` and
`cd frontend && npm i && npm run dev`. Tests: `cd backend && pytest`.
The first request downloads data from Elexon (needs internet) and caches it.

## Key assumption
The day-ahead decision is made on D-1 at a cutoff (default 09:00 UK, adjustable in the UI). For each half hour on day D
we use the latest forecast with `publishTime <= cutoff`; later forecasts are never used.
MAPE ignores half-hours with actual < 100 MW.

## Deploy
Backend: Render/Heroku (Dockerfile honours `$PORT`). Frontend: Vercel, root `frontend`, env `VITE_API_URL=<backend url>`.

Live app: _add link_
