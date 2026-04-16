# Revenue Cycle Optimization

## Run Locally

This repo has:

- a FastAPI backend in `backend`
- a React frontend in `frontend`

The frontend talks to the backend at `http://localhost:8000`.

## Prerequisites

- Python 3.11+ recommended
- Node.js 20+ recommended
- npm

## 1. Create the root env file

From the repo root:

```powershell
Copy-Item .env.example .env
```

`OPENAI_API_KEY` can be left blank for basic local development unless you are testing features that require it.

## 2. Run the backend

Open a terminal in the repo root, then:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r app\requirements.txt
uvicorn app.main:app --reload
```

The backend should be available at:

- `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`

Notes:

- Run `uvicorn app.main:app --reload` from the `backend` directory.
- The backend loads claim data from `data/FHIR_data/Claim.json`.

## 3. Run the frontend

Open a second terminal in the repo root, then:

```powershell
cd frontend
npm install
```

If you want the frontend to use the real backend, create `frontend/.env.local` with:

```env
REACT_APP_USE_MOCK_API=false
```

Then start the frontend:

```powershell
npm start
```

The frontend should open at:

- `http://localhost:3000`

## Frontend Modes

The frontend supports two local modes:

- Mock mode: leave `REACT_APP_USE_MOCK_API` unset, or set it to `true`
- Real backend mode: set `REACT_APP_USE_MOCK_API=false`

If you want to test the full stack locally, use real backend mode and make sure the FastAPI server is already running on port `8000`.

## Quick Start

If you want the full app running against the backend:

1. In terminal one, start the backend from `backend`.
2. In terminal two, set `REACT_APP_USE_MOCK_API=false` in `frontend/.env.local`.
3. Start the frontend from `frontend`.
4. Open `http://localhost:3000`.
