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
.venv\Scripts\uvicorn app.main:app --reload
```

## Frontend (React + Vite)

```powershell
cd schoolerp
npm install
npm run dev
```
