# School Management ERP

## Backend (FastAPI)

### First time setup (create virtual environment)
```powershell
cd school-erp-backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

### Run server
```powershell
cd school-erp-backend
docker-compose up -d            # Start PostgreSQL, Redis, MinIO
.venv\Scripts\uvicorn app.main:app --reload --port 8001
```

> **Note:** Backend must run on port **8001** (frontend proxy is configured to forward `/api` to `localhost:8001`).

## Frontend (React + Vite)

```powershell
cd schoolerp
npm install
npm run dev
```
