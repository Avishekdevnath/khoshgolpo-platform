# KhoshGolpo

Monorepo for a FastAPI + Next.js discussion platform.

## Structure

- `backend/` FastAPI API server
- `frontend/` Next.js 16 frontend
- `shared/` shared TypeScript types/constants
- `guide/` planning and reference docs

## Run Backend

```powershell
.\.venv\Scripts\python -m fastapi dev backend\app\main.py
```

Health: `http://127.0.0.1:8000/health`  
Docs: `http://127.0.0.1:8000/docs`

## Run Frontend

```powershell
cd frontend
cmd /c npm run dev
```

Frontend: `http://127.0.0.1:3000/`

## Backend Dependencies

```powershell
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
```
