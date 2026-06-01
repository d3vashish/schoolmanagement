# School Management ERP

## Setup from scratch

### 1. Clone & enter
```powershell
git clone https://github.com/d3vashish/schoolmanagement.git
cd schoolmanagement
```

### 2. Backend
```powershell
cd school-erp-backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
docker-compose up -d                    # Start PostgreSQL, Redis, MinIO
.venv\Scripts\alembic upgrade head      # Create database tables
.venv\Scripts\python scripts\seed_users.py   # Create default logins
.venv\Scripts\uvicorn app.main:app --reload --port 8001
```

> **Note:** Backend must run on port **8001** (frontend proxy forwards `/api` to `localhost:8001`).

### 3. Frontend
```powershell
cd schoolerp
npm install
npm run dev
```

### 4. Login
Open `http://localhost:5173` and use any of these:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@school.com | password123 |
| Principal | principal@school.com | password123 |
| Teacher | teacher@school.com | password123 |
| Accountant | accountant@school.com | password123 |
| Librarian | librarian@school.com | password123 |
| Parent | parent@school.com | password123 |
| Student | student@school.com | password123 |
