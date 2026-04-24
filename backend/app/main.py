from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import patient_optimize
from app.models import claim as claim_model

app = FastAPI(
    title="Revenue Cycle Optimization API",
    version="0.1"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(claim_model.router)
app.include_router(patient_optimize.router)


@app.get("/")
def root():
    return {"message": "Revenue Cycle Optimization API running"}
