# School Management ERP

## Backend (FastAPI)

```powershell
cd school-erp-backend
docker-compose up -d            # Start PostgreSQL, Redis, MinIO
.venv\Scripts\uvicorn app.main:app --reload
```

## Frontend (React + Vite)

```powershell
cd schoolerp
npm install
npm run dev
```
